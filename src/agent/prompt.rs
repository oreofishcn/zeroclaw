use crate::tools::Tool;
use anyhow::Result;
use chrono::Local;
use std::fmt::Write;
use std::path::Path;

pub struct PromptContext<'a> {
    pub workspace_dir: &'a Path,
    pub model_name: &'a str,
    pub tools: &'a [Box<dyn Tool>],
    pub dispatcher_instructions: &'a str,
}

pub trait PromptSection: Send + Sync {
    fn build(&self, ctx: &PromptContext<'_>) -> Result<String>;
}

#[derive(Default)]
pub struct SystemPromptBuilder {
    sections: Vec<Box<dyn PromptSection>>,
}

impl SystemPromptBuilder {
    pub fn with_defaults() -> Self {
        Self {
            sections: vec![
                Box::new(ToolsSection),
                Box::new(SafetySection),
                Box::new(WorkspaceSection),
                Box::new(DateTimeSection),
                Box::new(RuntimeSection),
            ],
        }
    }

    pub fn build(&self, ctx: &PromptContext<'_>) -> Result<String> {
        let mut output = String::new();
        for section in &self.sections {
            let part = section.build(ctx)?;
            if part.trim().is_empty() {
                continue;
            }
            output.push_str(part.trim_end());
            output.push_str("\n\n");
        }
        Ok(output)
    }
}

struct ToolsSection;
struct SafetySection;
struct WorkspaceSection;
struct DateTimeSection;
struct RuntimeSection;

impl PromptSection for ToolsSection {
    fn build(&self, ctx: &PromptContext<'_>) -> Result<String> {
        let mut out = String::from("## Tools\n\n");
        for tool in ctx.tools {
            let _ = writeln!(
                out,
                "- **{}**: {}\n  Parameters: `{}`",
                tool.name(),
                tool.description(),
                tool.parameters_schema()
            );
        }
        if !ctx.dispatcher_instructions.is_empty() {
            out.push('\n');
            out.push_str(ctx.dispatcher_instructions);
        }
        Ok(out)
    }
}

impl PromptSection for SafetySection {
    fn build(&self, _ctx: &PromptContext<'_>) -> Result<String> {
        Ok("## Safety\n\n- Stay inside the workspace.\n- Avoid destructive commands unless the user explicitly asks.\n- Prefer inspection before mutation.".to_string())
    }
}

impl PromptSection for WorkspaceSection {
    fn build(&self, ctx: &PromptContext<'_>) -> Result<String> {
        Ok(format!(
            "## Workspace\n\nWorking directory: `{}`",
            ctx.workspace_dir.display()
        ))
    }
}

impl PromptSection for DateTimeSection {
    fn build(&self, _ctx: &PromptContext<'_>) -> Result<String> {
        let now = Local::now();
        Ok(format!(
            "## Current Date & Time\n\n{} ({})",
            now.format("%Y-%m-%d %H:%M:%S"),
            now.format("%Z")
        ))
    }
}

impl PromptSection for RuntimeSection {
    fn build(&self, ctx: &PromptContext<'_>) -> Result<String> {
        Ok(format!(
            "## Runtime\n\nOS: {} | Model: {}",
            std::env::consts::OS,
            ctx.model_name
        ))
    }
}
