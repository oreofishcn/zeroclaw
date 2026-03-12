pub mod openai;
pub mod traits;

pub use openai::OpenAiProvider;
pub use traits::{
    ChatMessage, ChatRequest, ChatResponse, ConversationMessage, Provider, ProviderCapabilityError,
    ToolCall, ToolResultMessage,
};

pub fn create_provider(
    name: &str,
    api_key: Option<&str>,
    api_url: Option<&str>,
) -> anyhow::Result<Box<dyn Provider>> {
    let normalized = name.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "" | "openai" | "openai-compatible" | "compatible" => {
            Ok(Box::new(OpenAiProvider::with_base_url(api_url, api_key)))
        }
        other => anyhow::bail!(
            "unsupported provider '{other}'; minimal build only supports openai-compatible"
        ),
    }
}

async fn api_error(provider: &str, response: reqwest::Response) -> anyhow::Error {
    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|_| "<failed to read response body>".to_string());
    anyhow::anyhow!("{provider} API error {status}: {body}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_openai_provider() {
        assert!(create_provider("openai", Some("test-key"), None).is_ok());
        assert!(create_provider("compatible", None, Some("https://example.com/v1")).is_ok());
    }

    #[test]
    fn reject_non_minimal_provider() {
        assert!(create_provider("anthropic", None, None).is_err());
    }
}
