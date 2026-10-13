use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

/// Event emitted to the frontend when a mapping with use_chain triggers chain execution.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainExecutionRequestEvent {
    pub request_id: String,
    pub chain_id: String,
    pub mapping_id: String,
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub url: String,
    /// The real inbound request's data — lets the chain's entry node represent
    /// the actual request rather than the (response-shaped) data above.
    pub request_method: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: String,
}

/// Result returned from the frontend after chain execution completes.
pub struct ChainExecutionResult {
    pub status: u16,
    pub headers: HashMap<String, String>,
    /// One fully-formed `Set-Cookie` value per cookie — kept separate from
    /// `headers` because multiple Set-Cookie lines can't be folded into a
    /// single comma-joined header value (RFC 6265).
    pub set_cookies: Vec<String>,
    pub body: String,
    pub body_content_type: String,
}

/// Chain registry: maps request_id → oneshot sender so the resume_chain command can unblock waiting handlers.
pub type ChainRegistryRef = Arc<Mutex<HashMap<String, oneshot::Sender<Option<ChainExecutionResult>>>>>;

/// Shared configurable timeout (seconds) for chain execution.
pub type ChainTimeoutRef = Arc<Mutex<u64>>;

pub type ChainEmitFn = Arc<dyn Fn(&ChainExecutionRequestEvent) + Send + Sync + 'static>;

/// Event emitted to the frontend when a mapping with `needs_request_chain` matches an
/// inbound request — fires from `handle_request`, *before* the request is forwarded
/// upstream, so the frontend's result becomes the actual outbound request.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChainRequestExecutionEvent {
    pub request_id: String,
    pub chain_id: String,
    pub mapping_id: String,
    pub method: String,
    pub host: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

/// Result returned from the frontend after running just the Entry segment of a chain.
pub struct ChainRequestResult {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: String,
}

/// Chain request-side registry: maps request_id → oneshot sender so resume_chain_request can unblock waiting handlers.
pub type ChainRequestRegistryRef = Arc<Mutex<HashMap<String, oneshot::Sender<Option<ChainRequestResult>>>>>;

pub type ChainRequestEmitFn = Arc<dyn Fn(&ChainRequestExecutionEvent) + Send + Sync + 'static>;
