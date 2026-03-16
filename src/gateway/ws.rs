//! WebSocket agent chat handler.
//!
//! Protocol:
//! ```text
//! Client -> Server: {"type":"message","content":"Hello"}
//! Server -> Client: {"type":"chunk","content":"Hi! "}
//! Server -> Client: {"type":"tool_call","name":"shell","args":{...}}
//! Server -> Client: {"type":"tool_result","name":"shell","output":"..."}
//! Server -> Client: {"type":"done","full_response":"..."}
//! ```

use super::AppState;
use crate::channels::traits::ChannelMessage;
use crate::channels::web::WebChannelEvent;
use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    http::{header, HeaderMap},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::sync::mpsc::unbounded_channel;
use uuid::Uuid;

/// The sub-protocol we support for the chat WebSocket.
const WS_PROTOCOL: &str = "zeroclaw.v1";

/// Prefix used in `Sec-WebSocket-Protocol` to carry a bearer token.
const BEARER_SUBPROTO_PREFIX: &str = "bearer.";

#[derive(Deserialize)]
pub struct WsQuery {
    pub token: Option<String>,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum WsInboundAction {
    Message(String),
    Cancel,
    Ignore,
    Error(&'static str),
}

/// Extract a bearer token from WebSocket-compatible sources.
///
/// Precedence (first non-empty wins):
/// 1. `Authorization: Bearer <token>` header
/// 2. `Sec-WebSocket-Protocol: bearer.<token>` subprotocol
/// 3. `?token=<token>` query parameter
///
/// Browsers cannot set custom headers on `new WebSocket(url)`, so the query
/// parameter and subprotocol paths are required for browser-based clients.
fn extract_ws_token<'a>(headers: &'a HeaderMap, query_token: Option<&'a str>) -> Option<&'a str> {
    // 1. Authorization header
    if let Some(t) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|auth| auth.strip_prefix("Bearer "))
    {
        if !t.is_empty() {
            return Some(t);
        }
    }

    // 2. Sec-WebSocket-Protocol: bearer.<token>
    if let Some(t) = headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .and_then(|protos| {
            protos
                .split(',')
                .map(|p| p.trim())
                .find_map(|p| p.strip_prefix(BEARER_SUBPROTO_PREFIX))
        })
    {
        if !t.is_empty() {
            return Some(t);
        }
    }

    // 3. ?token= query parameter
    if let Some(t) = query_token {
        if !t.is_empty() {
            return Some(t);
        }
    }

    None
}

/// GET /ws/chat — WebSocket upgrade for agent chat
pub async fn handle_ws_chat(
    State(state): State<AppState>,
    Query(params): Query<WsQuery>,
    headers: HeaderMap,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Auth: check header, subprotocol, then query param (precedence order)
    if state.pairing.require_pairing() {
        let token = extract_ws_token(&headers, params.token.as_deref()).unwrap_or("");
        if !state.pairing.is_authenticated(token) {
            return (
                axum::http::StatusCode::UNAUTHORIZED,
                "Unauthorized — provide Authorization header, Sec-WebSocket-Protocol bearer, or ?token= query param",
            )
                .into_response();
        }
    }

    // Echo Sec-WebSocket-Protocol if the client requests our sub-protocol.
    let ws = if headers
        .get("sec-websocket-protocol")
        .and_then(|v| v.to_str().ok())
        .map_or(false, |protos| {
            protos.split(',').any(|p| p.trim() == WS_PROTOCOL)
        }) {
        ws.protocols([WS_PROTOCOL])
    } else {
        ws
    };

    let session_id = params.session_id.clone();
    ws.on_upgrade(move |socket| handle_socket(socket, state, session_id))
        .into_response()
}

async fn handle_socket(socket: WebSocket, state: AppState, session_id: Option<String>) {
    let session_id = session_id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let (mut sender, mut receiver) = socket.split();
    let (local_tx, mut local_rx) = unbounded_channel::<String>();
    let (session_tx, mut session_rx) = unbounded_channel::<WebChannelEvent>();
    let registration = state
        .web_runtime
        .channel()
        .register_session(session_id.clone(), session_tx);

    let writer = tokio::spawn(async move {
        loop {
            tokio::select! {
                maybe_local = local_rx.recv() => {
                    let Some(payload) = maybe_local else { break; };
                    if sender.send(Message::Text(payload.into())).await.is_err() {
                        break;
                    }
                }
                maybe_event = session_rx.recv() => {
                    let Some(event) = maybe_event else { break; };
                    let payload = web_event_payload(&event);
                    if sender.send(Message::Text(payload.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    let _ = local_tx.send(
        serde_json::json!({
            "type": "session_ready",
            "session_id": session_id,
        })
        .to_string(),
    );

    while let Some(msg) = receiver.next().await {
        let msg = match msg {
            Ok(Message::Text(text)) => text,
            Ok(Message::Close(_)) | Err(_) => break,
            _ => continue,
        };

        match parse_ws_inbound_action(&msg) {
            WsInboundAction::Message(content) => {
                let channel_message = web_channel_message(session_id.clone(), content);
                if let Err(e) = state.web_runtime.send(channel_message).await {
                    let sanitized = crate::providers::sanitize_api_error(&e.to_string());
                    let err = serde_json::json!({
                        "type": "error",
                        "message": sanitized,
                    });
                    let _ = local_tx.send(err.to_string());
                }
            }
            WsInboundAction::Cancel => {
                let cancel_message = web_channel_message(session_id.clone(), "/cancel".to_string());
                if let Err(e) = state.web_runtime.send(cancel_message).await {
                    let sanitized = crate::providers::sanitize_api_error(&e.to_string());
                    let err = serde_json::json!({
                        "type": "error",
                        "message": sanitized,
                    });
                    let _ = local_tx.send(err.to_string());
                } else {
                    let _ = local_tx.send(
                        serde_json::json!({
                            "type": "message_cancelled",
                            "session_id": session_id,
                        })
                        .to_string(),
                    );
                }
            }
            WsInboundAction::Ignore => {}
            WsInboundAction::Error(message) => {
                let err = serde_json::json!({"type": "error", "message": message});
                let _ = local_tx.send(err.to_string());
            }
        }
    }

    state
        .web_runtime
        .channel()
        .unregister_session(&registration);
    drop(local_tx);
    writer.abort();
}

fn web_event_payload(event: &WebChannelEvent) -> String {
    match event.event_type.as_str() {
        "message_final" => serde_json::json!({
            "type": "done",
            "full_response": event.content.clone().unwrap_or_default(),
            "message_id": event.message_id,
        }),
        "draft_start" => serde_json::json!({
            "type": "draft_start",
            "message_id": event.message_id,
            "content": event.content,
            "session_id": event.session_id,
        }),
        "draft_update" => serde_json::json!({
            "type": "chunk",
            "message_id": event.message_id,
            "content": event.content,
            "session_id": event.session_id,
        }),
        "draft_cancelled" => serde_json::json!({
            "type": "message_cancelled",
            "message_id": event.message_id,
            "session_id": event.session_id,
        }),
        "tool_call_start" => serde_json::json!({
            "type": "tool_call",
            "message_id": event.message_id,
            "content": event.content,
            "session_id": event.session_id,
        }),
        other => serde_json::json!({
            "type": other,
            "message_id": event.message_id,
            "content": event.content,
            "session_id": event.session_id,
        }),
    }
    .to_string()
}

fn unix_timestamp_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn web_channel_message(session_id: String, content: String) -> ChannelMessage {
    ChannelMessage {
        id: Uuid::new_v4().to_string(),
        sender: "local-user".to_string(),
        reply_target: session_id,
        content,
        channel: "web".to_string(),
        timestamp: unix_timestamp_secs(),
        thread_ts: None,
    }
}

fn parse_ws_inbound_action(raw: &str) -> WsInboundAction {
    let parsed: serde_json::Value = match serde_json::from_str(raw) {
        Ok(v) => v,
        Err(_) => return WsInboundAction::Error("Invalid JSON"),
    };

    match parsed["type"].as_str().unwrap_or("") {
        "message" => {
            let content = parsed["content"].as_str().unwrap_or("").trim().to_string();
            if content.is_empty() {
                WsInboundAction::Ignore
            } else {
                WsInboundAction::Message(content)
            }
        }
        "cancel" => WsInboundAction::Cancel,
        _ => WsInboundAction::Ignore,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    #[test]
    fn extract_ws_token_from_authorization_header() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer zc_test123".parse().unwrap());
        assert_eq!(extract_ws_token(&headers, None), Some("zc_test123"));
    }

    #[test]
    fn extract_ws_token_from_subprotocol() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "sec-websocket-protocol",
            "zeroclaw.v1, bearer.zc_sub456".parse().unwrap(),
        );
        assert_eq!(extract_ws_token(&headers, None), Some("zc_sub456"));
    }

    #[test]
    fn extract_ws_token_from_query_param() {
        let headers = HeaderMap::new();
        assert_eq!(
            extract_ws_token(&headers, Some("zc_query789")),
            Some("zc_query789")
        );
    }

    #[test]
    fn extract_ws_token_precedence_header_over_subprotocol() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer zc_header".parse().unwrap());
        headers.insert("sec-websocket-protocol", "bearer.zc_sub".parse().unwrap());
        assert_eq!(
            extract_ws_token(&headers, Some("zc_query")),
            Some("zc_header")
        );
    }

    #[test]
    fn extract_ws_token_precedence_subprotocol_over_query() {
        let mut headers = HeaderMap::new();
        headers.insert("sec-websocket-protocol", "bearer.zc_sub".parse().unwrap());
        assert_eq!(extract_ws_token(&headers, Some("zc_query")), Some("zc_sub"));
    }

    #[test]
    fn extract_ws_token_returns_none_when_empty() {
        let headers = HeaderMap::new();
        assert_eq!(extract_ws_token(&headers, None), None);
    }

    #[test]
    fn extract_ws_token_skips_empty_header_value() {
        let mut headers = HeaderMap::new();
        headers.insert("authorization", "Bearer ".parse().unwrap());
        assert_eq!(
            extract_ws_token(&headers, Some("zc_fallback")),
            Some("zc_fallback")
        );
    }

    #[test]
    fn extract_ws_token_skips_empty_query_param() {
        let headers = HeaderMap::new();
        assert_eq!(extract_ws_token(&headers, Some("")), None);
    }

    #[test]
    fn extract_ws_token_subprotocol_with_multiple_entries() {
        let mut headers = HeaderMap::new();
        headers.insert(
            "sec-websocket-protocol",
            "zeroclaw.v1, bearer.zc_tok, other".parse().unwrap(),
        );
        assert_eq!(extract_ws_token(&headers, None), Some("zc_tok"));
    }

    #[test]
    fn web_event_payload_maps_final_message_to_done_frame() {
        let payload = web_event_payload(&WebChannelEvent {
            event_type: "message_final".into(),
            session_id: "session-a".into(),
            message_id: Some("draft-1".into()),
            content: Some("hello".into()),
        });

        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(parsed["type"], "done");
        assert_eq!(parsed["full_response"], "hello");
        assert_eq!(parsed["message_id"], "draft-1");
    }

    #[test]
    fn web_event_payload_preserves_nonfinal_event_type() {
        let payload = web_event_payload(&WebChannelEvent {
            event_type: "typing_start".into(),
            session_id: "session-a".into(),
            message_id: None,
            content: None,
        });

        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(parsed["type"], "typing_start");
        assert_eq!(parsed["session_id"], "session-a");
    }

    #[test]
    fn web_event_payload_maps_draft_updates_to_chunk_frames() {
        let payload = web_event_payload(&WebChannelEvent {
            event_type: "draft_update".into(),
            session_id: "session-a".into(),
            message_id: Some("draft-1".into()),
            content: Some("partial".into()),
        });

        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(parsed["type"], "chunk");
        assert_eq!(parsed["message_id"], "draft-1");
        assert_eq!(parsed["content"], "partial");
    }

    #[test]
    fn web_event_payload_maps_tool_events_to_tool_call_frames() {
        let payload = web_event_payload(&WebChannelEvent {
            event_type: "tool_call_start".into(),
            session_id: "session-a".into(),
            message_id: Some("thread-1".into()),
            content: Some("\u{1F527} `shell`: ls".into()),
        });

        let parsed: serde_json::Value = serde_json::from_str(&payload).unwrap();
        assert_eq!(parsed["type"], "tool_call");
        assert_eq!(parsed["message_id"], "thread-1");
    }

    #[test]
    fn web_channel_message_uses_session_as_reply_target() {
        let msg = web_channel_message("session-a".to_string(), "hello".to_string());

        assert_eq!(msg.channel, "web");
        assert_eq!(msg.sender, "local-user");
        assert_eq!(msg.reply_target, "session-a");
        assert_eq!(msg.content, "hello");
    }

    #[test]
    fn parse_ws_inbound_action_extracts_message_content() {
        assert_eq!(
            parse_ws_inbound_action(r#"{"type":"message","content":"hello"}"#),
            WsInboundAction::Message("hello".to_string())
        );
    }

    #[test]
    fn parse_ws_inbound_action_recognizes_cancel_frames() {
        assert_eq!(
            parse_ws_inbound_action(r#"{"type":"cancel"}"#),
            WsInboundAction::Cancel
        );
    }

    #[test]
    fn parse_ws_inbound_action_ignores_empty_messages() {
        assert_eq!(
            parse_ws_inbound_action("{\"type\":\"message\",\"content\":\"   \"}"),
            WsInboundAction::Ignore
        );
    }

    #[test]
    fn parse_ws_inbound_action_reports_invalid_json() {
        assert_eq!(
            parse_ws_inbound_action("{"),
            WsInboundAction::Error("Invalid JSON")
        );
    }
}
