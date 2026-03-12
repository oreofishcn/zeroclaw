use anyhow::Context;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(skip)]
    pub config_path: PathBuf,
    #[serde(skip)]
    pub workspace_dir: PathBuf,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub api_url: Option<String>,
    #[serde(default = "default_provider")]
    pub default_provider: Option<String>,
    #[serde(default = "default_model")]
    pub default_model: Option<String>,
    #[serde(default = "default_temperature")]
    pub default_temperature: f64,
    #[serde(default)]
    pub agent: AgentConfig,
    #[serde(default)]
    pub autonomy: AutonomyConfig,
    #[serde(default)]
    pub runtime: RuntimeConfig,
    #[serde(default)]
    pub observability: ObservabilityConfig,
    #[serde(default)]
    pub memory: MemoryConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    #[serde(default = "default_max_tool_iterations")]
    pub max_tool_iterations: usize,
    #[serde(default = "default_max_history_messages")]
    pub max_history_messages: usize,
    #[serde(default = "default_tool_dispatcher")]
    pub tool_dispatcher: String,
    #[serde(default)]
    pub compact_context: bool,
    #[serde(default = "default_parallel_tools")]
    pub parallel_tools: bool,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillsPromptInjectionMode {
    #[default]
    Disabled,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct IdentityConfig;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct QueryClassificationConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutonomyConfig {
    #[serde(default)]
    pub level: crate::security::AutonomyLevel,
    #[serde(default = "default_workspace_only")]
    pub workspace_only: bool,
    #[serde(default = "default_allowed_commands")]
    pub allowed_commands: Vec<String>,
    #[serde(default = "default_forbidden_paths")]
    pub forbidden_paths: Vec<String>,
    #[serde(default)]
    pub allowed_roots: Vec<String>,
    #[serde(default = "default_max_actions_per_hour")]
    pub max_actions_per_hour: u32,
    #[serde(default = "default_max_cost_per_day_cents")]
    pub max_cost_per_day_cents: u32,
    #[serde(default = "default_require_approval_for_medium_risk")]
    pub require_approval_for_medium_risk: bool,
    #[serde(default = "default_block_high_risk_commands")]
    pub block_high_risk_commands: bool,
    #[serde(default)]
    pub shell_env_passthrough: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    #[serde(default = "default_runtime_kind")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObservabilityConfig {
    #[serde(default = "default_observability_backend")]
    pub backend: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryConfig {
    #[serde(default = "default_memory_backend")]
    pub backend: String,
    #[serde(default = "default_min_relevance_score")]
    pub min_relevance_score: f64,
}

fn default_provider() -> Option<String> {
    Some("openai".to_string())
}

fn default_model() -> Option<String> {
    Some("gpt-4o-mini".to_string())
}

const fn default_temperature() -> f64 {
    0.7
}

const fn default_max_tool_iterations() -> usize {
    10
}

const fn default_max_history_messages() -> usize {
    50
}

const fn default_parallel_tools() -> bool {
    false
}

fn default_tool_dispatcher() -> String {
    "auto".to_string()
}

const fn default_workspace_only() -> bool {
    true
}

fn default_allowed_commands() -> Vec<String> {
    crate::security::SecurityPolicy::default().allowed_commands
}

fn default_forbidden_paths() -> Vec<String> {
    crate::security::SecurityPolicy::default().forbidden_paths
}

const fn default_max_actions_per_hour() -> u32 {
    20
}

const fn default_max_cost_per_day_cents() -> u32 {
    500
}

const fn default_require_approval_for_medium_risk() -> bool {
    true
}

const fn default_block_high_risk_commands() -> bool {
    true
}

fn default_runtime_kind() -> String {
    "native".to_string()
}

fn default_observability_backend() -> String {
    "noop".to_string()
}

fn default_memory_backend() -> String {
    "none".to_string()
}

const fn default_min_relevance_score() -> f64 {
    0.4
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            max_tool_iterations: default_max_tool_iterations(),
            max_history_messages: default_max_history_messages(),
            tool_dispatcher: default_tool_dispatcher(),
            compact_context: false,
            parallel_tools: default_parallel_tools(),
        }
    }
}

impl Default for AutonomyConfig {
    fn default() -> Self {
        Self {
            level: crate::security::AutonomyLevel::Supervised,
            workspace_only: default_workspace_only(),
            allowed_commands: default_allowed_commands(),
            forbidden_paths: default_forbidden_paths(),
            allowed_roots: Vec::new(),
            max_actions_per_hour: default_max_actions_per_hour(),
            max_cost_per_day_cents: default_max_cost_per_day_cents(),
            require_approval_for_medium_risk: default_require_approval_for_medium_risk(),
            block_high_risk_commands: default_block_high_risk_commands(),
            shell_env_passthrough: Vec::new(),
        }
    }
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            kind: default_runtime_kind(),
        }
    }
}

impl Default for ObservabilityConfig {
    fn default() -> Self {
        Self {
            backend: default_observability_backend(),
        }
    }
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            backend: default_memory_backend(),
            min_relevance_score: default_min_relevance_score(),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        let base = default_base_dir();
        Self {
            config_path: base.join("config.toml"),
            workspace_dir: base.join("workspace"),
            api_key: None,
            api_url: None,
            default_provider: default_provider(),
            default_model: default_model(),
            default_temperature: default_temperature(),
            agent: AgentConfig::default(),
            autonomy: AutonomyConfig::default(),
            runtime: RuntimeConfig::default(),
            observability: ObservabilityConfig::default(),
            memory: MemoryConfig::default(),
        }
    }
}

impl Config {
    pub async fn load_or_init() -> anyhow::Result<Self> {
        Self::load_or_init_with_override(None).await
    }

    pub async fn load_or_init_with_override(config_dir: Option<&str>) -> anyhow::Result<Self> {
        let base_dir = config_dir.map_or_else(default_base_dir, PathBuf::from);
        let config_path = base_dir.join("config.toml");
        let workspace_dir = base_dir.join("workspace");

        fs::create_dir_all(&base_dir)
            .await
            .with_context(|| format!("failed to create config directory {}", base_dir.display()))?;
        fs::create_dir_all(&workspace_dir).await.with_context(|| {
            format!(
                "failed to create workspace directory {}",
                workspace_dir.display()
            )
        })?;

        if !config_path.exists() {
            let config = Self::default_for_paths(&config_path, &workspace_dir);
            let contents = toml::to_string_pretty(&config)?;
            fs::write(&config_path, contents).await.with_context(|| {
                format!("failed to initialize config file {}", config_path.display())
            })?;
            return Ok(config);
        }

        let contents = fs::read_to_string(&config_path)
            .await
            .with_context(|| format!("failed to read config file {}", config_path.display()))?;
        let mut config: Self = toml::from_str(&contents).context("failed to parse config file")?;
        config.config_path = config_path;
        config.workspace_dir = workspace_dir;
        Ok(config)
    }

    fn default_for_paths(config_path: &Path, workspace_dir: &Path) -> Self {
        Self {
            config_path: config_path.to_path_buf(),
            workspace_dir: workspace_dir.to_path_buf(),
            ..Self::default()
        }
    }
}

fn default_base_dir() -> PathBuf {
    directories::ProjectDirs::from("ai", "zeroclaw", "zeroclaw")
        .map(|dirs| dirs.config_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from(".zeroclaw"))
}

pub fn validate_temperature(temperature: f64) -> std::result::Result<f64, String> {
    if (0.0..=2.0).contains(&temperature) {
        Ok(temperature)
    } else {
        Err("temperature must be between 0.0 and 2.0".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_default_is_minimal() {
        let config = Config::default();
        assert_eq!(config.default_provider.as_deref(), Some("openai"));
        assert_eq!(config.default_model.as_deref(), Some("gpt-4o-mini"));
        assert_eq!(config.memory.backend, "none");
    }

    #[test]
    fn validate_temperature_bounds() {
        assert!(validate_temperature(0.0).is_ok());
        assert!(validate_temperature(2.0).is_ok());
        assert!(validate_temperature(-0.1).is_err());
        assert!(validate_temperature(2.1).is_err());
    }
}
