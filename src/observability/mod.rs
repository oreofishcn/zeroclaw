pub mod noop;
pub mod traits;

pub use noop::NoopObserver;
pub use traits::{Observer, ObserverEvent, ObserverMetric};

use crate::config::ObservabilityConfig;

pub fn create_observer(_config: &ObservabilityConfig) -> Box<dyn Observer> {
    Box::new(NoopObserver)
}
