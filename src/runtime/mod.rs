pub mod native;
pub mod traits;

pub use native::NativeRuntime;
pub use traits::RuntimeAdapter;

use crate::config::RuntimeConfig;

pub fn create_runtime(config: &RuntimeConfig) -> anyhow::Result<Box<dyn RuntimeAdapter>> {
    if config.kind.trim().is_empty() || config.kind == "native" {
        Ok(Box::new(NativeRuntime::new()))
    } else {
        anyhow::bail!(
            "unknown runtime kind '{}'; minimal build only supports native",
            config.kind
        )
    }
}
