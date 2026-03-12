pub mod schema;

pub use schema::{
    validate_temperature, AgentConfig, AutonomyConfig, Config, IdentityConfig, MemoryConfig,
    ObservabilityConfig, QueryClassificationConfig, RuntimeConfig, SkillsPromptInjectionMode,
};

pub fn build_runtime_proxy_client_with_timeouts(
    _scope: &str,
    timeout_secs: u64,
    connect_timeout_secs: u64,
) -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .connect_timeout(std::time::Duration::from_secs(connect_timeout_secs))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new())
}
