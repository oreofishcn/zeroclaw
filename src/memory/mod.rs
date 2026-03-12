pub mod none;
pub mod traits;

pub use none::NoneMemory;
pub use traits::{Memory, MemoryCategory, MemoryEntry};

use crate::config::MemoryConfig;
use std::path::Path;

pub fn create_memory(
    _config: &MemoryConfig,
    _workspace_dir: &Path,
    _api_key: Option<&str>,
) -> anyhow::Result<Box<dyn Memory>> {
    Ok(Box::new(NoneMemory::new()))
}

pub fn is_assistant_autosave_key(key: &str) -> bool {
    let normalized = key.trim().to_ascii_lowercase();
    normalized == "assistant_resp" || normalized.starts_with("assistant_resp_")
}
