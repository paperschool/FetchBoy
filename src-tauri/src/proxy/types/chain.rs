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
}

/// Result returned from the frontend after chain execution completes.
pub struct ChainExecutionResult {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub body_content_type: String,
}

/// Chain registry: maps request_id → oneshot sender so the resume_chain command can unblock waiting handlers.
pub type ChainRegistryRef = Arc<Mutex<HashMap<String, oneshot::Sender<Option<ChainExecutionResult>>>>>;

/// Shared configurable timeout (seconds) for chain execution.
pub type ChainTimeoutRef = Arc<Mutex<u64>>;

pub type ChainEmitFn = Arc<dyn Fn(&ChainExecutionRequestEvent) + Send + Sync + 'static>;
