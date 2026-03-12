pub mod file_edit;
pub mod file_read;
pub mod file_write;
pub mod shell;
pub mod traits;

pub use file_edit::FileEditTool;
pub use file_read::FileReadTool;
pub use file_write::FileWriteTool;
pub use shell::ShellTool;
pub use traits::{Tool, ToolResult, ToolSpec};

use crate::runtime::{NativeRuntime, RuntimeAdapter};
use crate::security::SecurityPolicy;
use std::sync::Arc;

pub fn default_tools(security: Arc<SecurityPolicy>) -> Vec<Box<dyn Tool>> {
    default_tools_with_runtime(security, Arc::new(NativeRuntime::new()))
}

pub fn default_tools_with_runtime(
    security: Arc<SecurityPolicy>,
    runtime: Arc<dyn RuntimeAdapter>,
) -> Vec<Box<dyn Tool>> {
    vec![
        Box::new(ShellTool::new(security.clone(), runtime)),
        Box::new(FileReadTool::new(security.clone())),
        Box::new(FileWriteTool::new(security.clone())),
        Box::new(FileEditTool::new(security)),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_registry_contains_only_minimal_tools() {
        let security = Arc::new(SecurityPolicy::default());
        let tools = default_tools(security);
        let names: Vec<&str> = tools.iter().map(|tool| tool.name()).collect();
        assert_eq!(names, vec!["shell", "file_read", "file_write", "file_edit"]);
    }
}
