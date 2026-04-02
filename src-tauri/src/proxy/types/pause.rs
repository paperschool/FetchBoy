use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

use super::events::InterceptRequestEvent;

/// Per-request state held between handle_request and handle_response.
#[derive(Clone)]
pub(crate) struct PendingRequest {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub request_headers: HashMap<String, String>,
    /// Written by handle_request's async block; read by handle_response.
    pub request_body: Arc<Mutex<Option<String>>>,
    /// Monotonic instant captured when the request starts, used to compute response time.
    pub started: std::time::Instant,
}

impl PendingRequest {
    /// Create an `InterceptRequestEvent` from this pending request for emission to the frontend.
    pub fn to_request_event(&self) -> InterceptRequestEvent {
        InterceptRequestEvent {
            id: self.id.clone(),
            timestamp: self.timestamp,
            method: self.method.clone(),
            host: self.host.clone(),
            path: self.path.clone(),
            request_headers: self.request_headers.clone(),
            request_body: self
                .request_body
                .lock()
                .expect("PendingRequest.request_body lock")
                .clone(),
        }
    }
}

/// User-supplied modifications when resuming via "Edit & Continue".
#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointModifications {
    pub status_code: Option<u16>,
    pub response_body: Option<String>,
    pub content_type: Option<String>,
    pub headers: Vec<[String; 2]>,
}

/// Decision sent through the pause channel to unblock handle_response.
pub enum PauseDecision {
    Continue,
    Drop,
    Modify(BreakpointModifications),
}

/// Pause registry: maps request_id → oneshot sender so Tauri commands can unblock waiting handlers.
pub type PauseRegistryRef = Arc<Mutex<HashMap<String, oneshot::Sender<PauseDecision>>>>;

/// Shared configurable timeout (seconds) for paused requests.
pub type PauseTimeoutRef = Arc<Mutex<u64>>;

/// Event emitted to the frontend when a request is paused at a breakpoint.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BreakpointPausedEvent {
    pub request_id: String,
    pub breakpoint_id: String,
    pub breakpoint_name: String,
    pub timeout_at: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<u16>,
    pub response_body: Option<String>,
    pub response_headers: HashMap<String, String>,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
}

pub type PausedEmitFn = Arc<dyn Fn(&BreakpointPausedEvent) + Send + Sync + 'static>;
