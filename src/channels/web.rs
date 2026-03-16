use crate::channels::traits::{Channel, ChannelMessage, SendMessage};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tokio::sync::mpsc::UnboundedSender;
use uuid::Uuid;
#[cfg(test)]
use tokio::sync::mpsc::{unbounded_channel, UnboundedReceiver};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebChannelEvent {
    pub event_type: String,
    pub session_id: String,
    pub message_id: Option<String>,
    pub content: Option<String>,
}

impl WebChannelEvent {
    fn new(
        event_type: impl Into<String>,
        session_id: impl Into<String>,
        message_id: Option<String>,
        content: Option<String>,
    ) -> Self {
        Self {
            event_type: event_type.into(),
            session_id: session_id.into(),
            message_id,
            content,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebSessionRegistration {
    session_id: String,
    connection_id: Uuid,
}

#[derive(Debug)]
struct RegisteredSession {
    connection_id: Uuid,
    tx: UnboundedSender<WebChannelEvent>,
}

#[derive(Debug, Default)]
struct WebSessionRegistry {
    sessions: RwLock<HashMap<String, RegisteredSession>>,
}

impl WebSessionRegistry {
    fn register(
        &self,
        session_id: impl Into<String>,
        tx: UnboundedSender<WebChannelEvent>,
    ) -> WebSessionRegistration {
        let registration = WebSessionRegistration {
            session_id: session_id.into(),
            connection_id: Uuid::new_v4(),
        };
        self.sessions
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .insert(
                registration.session_id.clone(),
                RegisteredSession {
                    connection_id: registration.connection_id,
                    tx,
                },
            );
        registration
    }

    fn unregister(&self, registration: &WebSessionRegistration) {
        let mut sessions = self.sessions.write().unwrap_or_else(|e| e.into_inner());
        let should_remove = sessions
            .get(&registration.session_id)
            .is_some_and(|current| current.connection_id == registration.connection_id);
        if should_remove {
            sessions.remove(&registration.session_id);
        }
    }

    fn emit(
        &self,
        session_id: &str,
        event_type: &str,
        message_id: Option<String>,
        content: Option<String>,
    ) -> anyhow::Result<()> {
        let tx = self
            .sessions
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .get(session_id)
            .map(|session| session.tx.clone())
            .ok_or_else(|| anyhow!("unknown web session: {session_id}"))?;

        tx.send(WebChannelEvent::new(
            event_type, session_id, message_id, content,
        ))
        .map_err(|_| anyhow!("web session disconnected: {session_id}"))
    }
}

#[derive(Debug, Clone, Default)]
pub struct WebChannel {
    registry: Arc<WebSessionRegistry>,
}

impl WebChannel {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register_session(
        &self,
        session_id: impl Into<String>,
        tx: UnboundedSender<WebChannelEvent>,
    ) -> WebSessionRegistration {
        self.registry.register(session_id, tx)
    }

    pub fn unregister_session(&self, registration: &WebSessionRegistration) {
        self.registry.unregister(registration);
    }

    #[cfg(test)]
    pub fn for_test(session_id: &str) -> (Self, UnboundedReceiver<WebChannelEvent>) {
        let channel = Self::new();
        let (tx, rx) = unbounded_channel();
        let _registration = channel.register_session(session_id.to_string(), tx);
        (channel, rx)
    }
}

#[async_trait]
impl Channel for WebChannel {
    fn name(&self) -> &str {
        "web"
    }

    async fn send(&self, message: &SendMessage) -> Result<()> {
        let event_type = if message.thread_ts.is_some() && message.content.starts_with('\u{1F527}')
        {
            "tool_call_start"
        } else {
            "message_final"
        };
        self.registry.emit(
            &message.recipient,
            event_type,
            message.thread_ts.clone(),
            Some(message.content.clone()),
        )
    }

    async fn listen(&self, _tx: tokio::sync::mpsc::Sender<ChannelMessage>) -> Result<()> {
        Ok(())
    }

    async fn start_typing(&self, recipient: &str) -> Result<()> {
        self.registry.emit(recipient, "typing_start", None, None)
    }

    async fn stop_typing(&self, recipient: &str) -> Result<()> {
        self.registry.emit(recipient, "typing_stop", None, None)
    }

    fn supports_draft_updates(&self) -> bool {
        true
    }

    async fn send_draft(&self, message: &SendMessage) -> Result<Option<String>> {
        let draft_id = format!("draft-{}", uuid::Uuid::new_v4());
        self.registry.emit(
            &message.recipient,
            "draft_start",
            Some(draft_id.clone()),
            Some(message.content.clone()),
        )?;
        Ok(Some(draft_id))
    }

    async fn update_draft(&self, recipient: &str, message_id: &str, text: &str) -> Result<()> {
        self.registry.emit(
            recipient,
            "draft_update",
            Some(message_id.to_string()),
            Some(text.to_string()),
        )
    }

    async fn finalize_draft(&self, recipient: &str, message_id: &str, text: &str) -> Result<()> {
        self.registry.emit(
            recipient,
            "message_final",
            Some(message_id.to_string()),
            Some(text.to_string()),
        )
    }

    async fn cancel_draft(&self, recipient: &str, message_id: &str) -> Result<()> {
        self.registry.emit(
            recipient,
            "draft_cancelled",
            Some(message_id.to_string()),
            None,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn web_channel_send_targets_matching_session() {
        let (channel, mut rx) = WebChannel::for_test("session-a");
        channel
            .send(&SendMessage::new("hello", "session-a"))
            .await
            .expect("send should succeed");

        let event = rx.recv().await.expect("event should exist");
        assert_eq!(event.event_type, "message_final");
        assert_eq!(event.session_id, "session-a");
        assert_eq!(event.message_id, None);
        assert_eq!(event.content.as_deref(), Some("hello"));
    }

    #[tokio::test]
    async fn web_channel_typing_events_target_matching_session() {
        let (channel, mut rx) = WebChannel::for_test("session-a");

        channel
            .start_typing("session-a")
            .await
            .expect("typing start should succeed");
        channel
            .stop_typing("session-a")
            .await
            .expect("typing stop should succeed");

        let start = rx.recv().await.expect("start event should exist");
        let stop = rx.recv().await.expect("stop event should exist");

        assert_eq!(start.event_type, "typing_start");
        assert_eq!(stop.event_type, "typing_stop");
        assert_eq!(start.session_id, "session-a");
        assert_eq!(stop.session_id, "session-a");
    }

    #[tokio::test]
    async fn web_channel_emits_draft_lifecycle_events() {
        let (channel, mut rx) = WebChannel::for_test("session-a");
        let draft_id = channel
            .send_draft(&SendMessage::new("...", "session-a"))
            .await
            .expect("draft should start")
            .expect("draft id should exist");

        channel
            .update_draft("session-a", &draft_id, "partial")
            .await
            .expect("draft update should succeed");
        channel
            .finalize_draft("session-a", &draft_id, "complete")
            .await
            .expect("draft finalize should succeed");

        let start = rx.recv().await.expect("draft start should exist");
        let update = rx.recv().await.expect("draft update should exist");
        let finalize = rx.recv().await.expect("draft finalize should exist");

        assert_eq!(start.event_type, "draft_start");
        assert_eq!(start.message_id.as_deref(), Some(draft_id.as_str()));
        assert_eq!(update.event_type, "draft_update");
        assert_eq!(update.content.as_deref(), Some("partial"));
        assert_eq!(finalize.event_type, "message_final");
        assert_eq!(finalize.content.as_deref(), Some("complete"));
    }

    #[tokio::test]
    async fn web_channel_maps_threaded_tool_messages_to_tool_events() {
        let (channel, mut rx) = WebChannel::for_test("session-a");
        channel
            .send(
                &SendMessage::new("\u{1F527} `shell`: ls", "session-a")
                    .in_thread(Some("thread-1".to_string())),
            )
            .await
            .expect("threaded tool event should succeed");

        let event = rx.recv().await.expect("tool event should exist");
        assert_eq!(event.event_type, "tool_call_start");
        assert_eq!(event.message_id.as_deref(), Some("thread-1"));
    }

    #[tokio::test]
    async fn web_channel_send_unknown_session_returns_error() {
        let (channel, _rx) = WebChannel::for_test("session-a");

        let err = channel
            .send(&SendMessage::new("hello", "session-b"))
            .await
            .expect_err("unknown session should return error");

        assert!(err.to_string().contains("unknown web session"));
    }

    #[tokio::test]
    async fn stale_unregister_does_not_remove_newer_session_registration() {
        let channel = WebChannel::new();
        let (old_tx, _old_rx) = unbounded_channel();
        let old_registration = channel.register_session("session-a".to_string(), old_tx);
        let (new_tx, mut new_rx) = unbounded_channel();
        let _new_registration = channel.register_session("session-a".to_string(), new_tx);

        channel.unregister_session(&old_registration);
        channel
            .send(&SendMessage::new("hello", "session-a"))
            .await
            .expect("newer registration should stay active");

        let event = new_rx.recv().await.expect("new registration should receive event");
        assert_eq!(event.content.as_deref(), Some("hello"));
    }
}
