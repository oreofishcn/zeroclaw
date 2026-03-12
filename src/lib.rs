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

pub mod agent;
pub mod config;
pub mod memory;
pub mod observability;
pub mod providers;
pub mod runtime;
pub mod security;
mod skills;
pub mod tools;

pub use config::Config;
