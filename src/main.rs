#![warn(clippy::all, clippy::pedantic)]
#![allow(
    dead_code,
    clippy::doc_markdown,
    clippy::missing_errors_doc,
    clippy::map_unwrap_or,
    clippy::module_name_repetitions,
    clippy::must_use_candidate,
    clippy::new_without_default,
    clippy::redundant_closure_for_method_calls,
    clippy::return_self_not_must_use,
    clippy::single_match_else,
    clippy::uninlined_format_args,
    clippy::unnecessary_literal_bound,
    clippy::unnecessary_wraps,
    clippy::unused_self
)]

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::{fmt, EnvFilter};
use zeroclaw::{agent, config, config::Config};

fn parse_temperature(s: &str) -> std::result::Result<f64, String> {
    let t: f64 = s.parse().map_err(|e| format!("{e}"))?;
    config::schema::validate_temperature(t)
}

#[derive(Parser, Debug)]
#[command(name = "zeroclaw")]
#[command(author = "theonlyhennygod")]
#[command(version)]
#[command(about = "Minimal ZeroClaw runtime", long_about = None)]
struct Cli {
    #[arg(long, global = true)]
    config_dir: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start the AI agent loop
    Agent {
        /// Single message mode (don't enter interactive mode)
        #[arg(short, long)]
        message: Option<String>,

        /// Provider to use (only openai-compatible providers are supported)
        #[arg(short, long)]
        provider: Option<String>,

        /// Model to use
        #[arg(long)]
        model: Option<String>,

        /// Temperature (0.0 - 2.0)
        #[arg(short, long, value_parser = parse_temperature)]
        temperature: Option<f64>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .with_target(false)
        .init();

    let cli = Cli::parse();
    let mut config = Config::load_or_init_with_override(cli.config_dir.as_deref()).await?;

    match cli.command {
        Commands::Agent {
            message,
            provider,
            model,
            temperature,
        } => {
            let temperature = temperature.unwrap_or(config.default_temperature);
            if let Some(provider) = provider {
                config.default_provider = Some(provider);
            }
            if let Some(model) = model {
                config.default_model = Some(model);
            }
            config.default_temperature = temperature;
            agent::run(config, message, None, None, temperature).await
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::CommandFactory;

    #[test]
    fn agent_command_parses_with_temperature() {
        let cli = Cli::try_parse_from(["zeroclaw", "agent", "--temperature", "0.5"])
            .expect("agent command with temperature should parse");

        match cli.command {
            Commands::Agent { temperature, .. } => assert_eq!(temperature, Some(0.5)),
        }
    }

    #[test]
    fn cli_help_only_mentions_agent() {
        let help = Cli::command().render_long_help().to_string();
        assert!(help.contains("agent"));
        assert!(!help.contains("gateway"));
        assert!(!help.contains("channel"));
    }
}
