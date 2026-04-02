use serde::Serialize;
use std::collections::HashMap;

/// Request-only event emitted as soon as the proxy intercepts a request (before
/// the upstream response arrives). Linked to the later response via `id`.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptRequestEvent {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
}

/// Response-only event emitted when the upstream response arrives.
/// `id` matches the earlier `InterceptRequestEvent` so the frontend can pair them.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptResponseEvent {
    pub id: String,
    pub status_code: u16,
    pub status_text: String,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub content_type: Option<String>,
    pub size: u64,
    pub response_time_ms: i64,
    pub is_blocked: Option<bool>,
}

/// Event emitted to the frontend when a mapping is applied to a request.
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MappingAppliedEvent {
    pub mapping_id: String,
    pub mapping_name: String,
    pub request_id: String,
    pub timestamp: i64,
    pub overrides_applied: Vec<String>,
    pub original_url: Option<String>,
    pub remapped_url: Option<String>,
}

pub type RequestEmitFn = std::sync::Arc<dyn Fn(&InterceptRequestEvent) + Send + Sync + 'static>;
pub type ResponseEmitFn = std::sync::Arc<dyn Fn(&InterceptResponseEvent) + Send + Sync + 'static>;
pub type MappingEmitFn = std::sync::Arc<dyn Fn(&MappingAppliedEvent) + Send + Sync + 'static>;
