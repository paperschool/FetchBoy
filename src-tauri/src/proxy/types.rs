use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

// ─── Constants ────────────────────────────────────────────────────────────────

/// Maximum response body size to capture (1 MB). Larger bodies are skipped.
pub const MAX_BODY_CAPTURE_BYTES: usize = 1024 * 1024;

// ─── Split event payloads ──────────────────────────────────────────────────────

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

// ─── Per-request state held between handle_request and handle_response ────────

#[derive(Clone)]
pub(crate) struct PendingRequest {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub request_headers: HashMap<String, String>,
    /// Written by handle_request's async block; read by handle_response.
    /// Uses Arc<Mutex> so the async future (which can't hold &mut self) can write it
    /// while handle_response reads it from self.pending after the future completes.
    pub request_body: Arc<Mutex<Option<String>>>,
    /// Monotonic instant captured when the request starts, used to compute response time.
    pub started: std::time::Instant,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

pub fn is_text_content_type(content_type: &str) -> bool {
    let ct = content_type.to_lowercase();
    ct.starts_with("text/")
        || ct.contains("json")
        || ct.contains("xml")
        || ct.contains("html")
        || ct.contains("javascript")
        || ct.contains("x-www-form-urlencoded")
}

pub fn collect_headers(
    headers: &hudsucker::hyper::HeaderMap,
) -> HashMap<String, String> {
    headers
        .iter()
        .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.to_string(), s.to_string())))
        .collect()
}

// ─── Breakpoint rules (synced from frontend) ─────────────────────────────────

#[derive(Deserialize, Clone)]
pub struct BreakpointHeader {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Deserialize, Clone)]
pub struct BreakpointRule {
    pub id: String,
    pub name: String,
    pub url_pattern: String,
    pub match_type: String,
    pub enabled: bool,
    pub response_mapping_enabled: bool,
    pub response_mapping_body: String,
    pub response_mapping_content_type: String,
    pub status_code_enabled: bool,
    pub status_code_value: u16,
    pub custom_headers: Vec<BreakpointHeader>,
    pub block_request_enabled: bool,
    pub block_request_status_code: u16,
    pub block_request_body: String,
}

pub type BreakpointsRef = Arc<Mutex<Vec<BreakpointRule>>>;

// ─── Mapping rules (synced from frontend) ─────────────────────────────────────

#[derive(Deserialize, Clone)]
pub struct MappingHeader {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Deserialize, Clone)]
pub struct MappingCookie {
    pub name: String,
    pub value: String,
    pub domain: String,
    pub path: String,
    pub secure: bool,
    #[serde(rename = "httpOnly")]
    pub http_only: bool,
    #[serde(rename = "sameSite")]
    pub same_site: String,
    pub expires: String,
}

#[derive(Deserialize, Clone)]
pub struct MappingRule {
    pub id: String,
    pub url_pattern: String,
    pub match_type: String,
    pub enabled: bool,
    pub headers_add: Vec<MappingHeader>,
    pub headers_remove: Vec<MappingHeader>,
    pub cookies: Vec<MappingCookie>,
    pub response_body_enabled: bool,
    pub response_body: String,
    pub response_body_content_type: String,
    pub response_body_file_path: String,
    pub url_remap_enabled: bool,
    pub url_remap_target: String,
    #[serde(default)]
    pub use_chain: bool,
    pub chain_id: Option<String>,
}

pub type MappingsRef = Arc<Mutex<Vec<MappingRule>>>;

/// Read a mapping's response body as raw bytes, preferring file path over inline body.
/// Falls back to inline body if file read fails, logging a warning.
/// Returns raw bytes to support both text and binary files (images, etc.).
pub async fn read_mapping_response_body(rule: &MappingRule) -> (Vec<u8>, String) {
    let ct = rule.response_body_content_type.clone();
    if !rule.response_body_file_path.is_empty() {
        match tokio::fs::read(&rule.response_body_file_path).await {
            Ok(content) => return (content, ct),
            Err(e) => {
                log::warn!(
                    "Mapping '{}': failed to read file '{}': {} — falling back to inline body",
                    rule.id, rule.response_body_file_path, e,
                );
            }
        }
    }
    (rule.response_body.clone().into_bytes(), ct)
}

// ─── Pause / resume types ──────────────────────────────────────────────────────

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

// ─── Mapping applied event ────────────────────────────────────────────────────

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

// ─── Chain execution types ──────────────────────────────────────────────────

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

pub type PausedEmitFn = Arc<dyn Fn(&BreakpointPausedEvent) + Send + Sync + 'static>;
pub type RequestEmitFn = Arc<dyn Fn(&InterceptRequestEvent) + Send + Sync + 'static>;
pub type ResponseEmitFn = Arc<dyn Fn(&InterceptResponseEvent) + Send + Sync + 'static>;
pub type MappingEmitFn = Arc<dyn Fn(&MappingAppliedEvent) + Send + Sync + 'static>;

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_text_content_type_matches_common_types() {
        assert!(is_text_content_type("application/json"));
        assert!(is_text_content_type("application/json; charset=utf-8"));
        assert!(is_text_content_type("text/plain"));
        assert!(is_text_content_type("text/html"));
        assert!(is_text_content_type("application/xml"));
        assert!(is_text_content_type("text/javascript"));
        assert!(!is_text_content_type("image/png"));
        assert!(!is_text_content_type("application/octet-stream"));
        assert!(!is_text_content_type("image/gif"));
    }

    #[test]
    fn breakpoint_header_deserialises_correctly() {
        let json = r#"{"key": "Authorization", "value": "Bearer test", "enabled": false}"#;
        let header: BreakpointHeader = serde_json::from_str(json).unwrap();
        assert_eq!(header.key, "Authorization");
        assert_eq!(header.value, "Bearer test");
        assert!(!header.enabled);
    }

    #[test]
    fn breakpoint_rule_deserialises_with_new_fields() {
        let json = r#"{
            "id": "bp1",
            "name": "Test BP 1",
            "url_pattern": "api/users",
            "match_type": "partial",
            "enabled": true,
            "response_mapping_enabled": false,
            "response_mapping_body": "",
            "response_mapping_content_type": "application/json",
            "status_code_enabled": true,
            "status_code_value": 404,
            "custom_headers": [
                {"key": "X-Custom", "value": "test", "enabled": true}
            ],
            "block_request_enabled": false,
            "block_request_status_code": 501,
            "block_request_body": ""
        }"#;
        let rule: BreakpointRule = serde_json::from_str(json).unwrap();
        assert_eq!(rule.id, "bp1");
        assert!(rule.status_code_enabled);
        assert_eq!(rule.status_code_value, 404);
        assert_eq!(rule.custom_headers.len(), 1);
        assert_eq!(rule.custom_headers[0].key, "X-Custom");
        assert!(rule.custom_headers[0].enabled);
        assert!(!rule.block_request_enabled);
    }

    #[test]
    fn breakpoint_rule_deserialises_with_empty_custom_headers() {
        let json = r#"{
            "id": "bp2",
            "name": "Test BP 2",
            "url_pattern": "api/orders",
            "match_type": "partial",
            "enabled": true,
            "response_mapping_enabled": false,
            "response_mapping_body": "",
            "response_mapping_content_type": "application/json",
            "status_code_enabled": false,
            "status_code_value": 200,
            "custom_headers": [],
            "block_request_enabled": false,
            "block_request_status_code": 501,
            "block_request_body": ""
        }"#;
        let rule: BreakpointRule = serde_json::from_str(json).unwrap();
        assert!(!rule.status_code_enabled);
        assert_eq!(rule.status_code_value, 200);
        assert!(rule.custom_headers.is_empty());
    }

    #[test]
    fn breakpoint_rule_deserialises_with_blocking_enabled() {
        let json = r#"{
            "id": "bp3",
            "name": "Test BP 3",
            "url_pattern": "api/blocked",
            "match_type": "partial",
            "enabled": true,
            "response_mapping_enabled": false,
            "response_mapping_body": "",
            "response_mapping_content_type": "application/json",
            "status_code_enabled": false,
            "status_code_value": 200,
            "custom_headers": [],
            "block_request_enabled": true,
            "block_request_status_code": 403,
            "block_request_body": "{\"error\":\"blocked\"}"
        }"#;
        let rule: BreakpointRule = serde_json::from_str(json).unwrap();
        assert!(rule.block_request_enabled);
        assert_eq!(rule.block_request_status_code, 403);
        assert_eq!(rule.block_request_body, "{\"error\":\"blocked\"}");
    }

    // ─── Split event struct tests ─────────────────────────────────────────────

    #[test]
    fn intercept_request_event_serialises_camelcase_fields() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let event = InterceptRequestEvent {
            id: "req-123".to_string(),
            timestamp: 1700000000000,
            method: "POST".to_string(),
            host: "api.example.com".to_string(),
            path: "/v1/users".to_string(),
            request_headers: headers,
            request_body: Some("{\"name\":\"test\"}".to_string()),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["id"], "req-123");
        assert_eq!(json["timestamp"], 1700000000000i64);
        assert_eq!(json["method"], "POST");
        assert_eq!(json["host"], "api.example.com");
        assert_eq!(json["path"], "/v1/users");
        assert_eq!(json["requestHeaders"]["content-type"], "application/json");
        assert_eq!(json["requestBody"], "{\"name\":\"test\"}");
    }

    #[test]
    fn intercept_request_event_optional_body_is_null_when_none() {
        let event = InterceptRequestEvent {
            id: "req-456".to_string(),
            timestamp: 0,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/".to_string(),
            request_headers: HashMap::new(),
            request_body: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert!(json["requestBody"].is_null());
    }

    #[test]
    fn intercept_response_event_serialises_camelcase_fields() {
        let mut headers = HashMap::new();
        headers.insert("x-request-id".to_string(), "abc123".to_string());

        let event = InterceptResponseEvent {
            id: "req-123".to_string(),
            status_code: 200,
            status_text: "OK".to_string(),
            response_headers: headers,
            response_body: Some("{\"ok\":true}".to_string()),
            content_type: Some("application/json".to_string()),
            size: 1024,
            response_time_ms: 150,
            is_blocked: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["id"], "req-123");
        assert_eq!(json["statusCode"], 200);
        assert_eq!(json["statusText"], "OK");
        assert_eq!(json["responseHeaders"]["x-request-id"], "abc123");
        assert_eq!(json["responseBody"], "{\"ok\":true}");
        assert_eq!(json["contentType"], "application/json");
        assert_eq!(json["size"], 1024);
        assert_eq!(json["responseTimeMs"], 150);
        assert!(json["isBlocked"].is_null());
    }

    #[test]
    fn intercept_response_event_blocked_fields() {
        let event = InterceptResponseEvent {
            id: "req-789".to_string(),
            status_code: 403,
            status_text: "Forbidden".to_string(),
            response_headers: HashMap::new(),
            response_body: Some("{\"error\":\"blocked\"}".to_string()),
            content_type: Some("text/plain".to_string()),
            size: 0,
            response_time_ms: 0,
            is_blocked: Some(true),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["isBlocked"], true);
        assert_eq!(json["statusCode"], 403);
        assert_eq!(json["statusText"], "Forbidden");
    }

    #[test]
    fn intercept_response_event_optional_fields_null_when_none() {
        let event = InterceptResponseEvent {
            id: "req-000".to_string(),
            status_code: 502,
            status_text: "Bad Gateway".to_string(),
            response_headers: HashMap::new(),
            response_body: None,
            content_type: None,
            size: 0,
            response_time_ms: 5000,
            is_blocked: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert!(json["responseBody"].is_null());
        assert!(json["contentType"].is_null());
        assert!(json["isBlocked"].is_null());
    }

    #[test]
    fn request_and_response_events_linked_by_id() {
        let shared_id = "link-test-id".to_string();

        let req_event = InterceptRequestEvent {
            id: shared_id.clone(),
            timestamp: 1000,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/api/data".to_string(),
            request_headers: HashMap::new(),
            request_body: None,
        };

        let resp_event = InterceptResponseEvent {
            id: shared_id.clone(),
            status_code: 200,
            status_text: "OK".to_string(),
            response_headers: HashMap::new(),
            response_body: Some("{\"data\":[]}".to_string()),
            content_type: Some("application/json".to_string()),
            size: 11,
            response_time_ms: 42,
            is_blocked: None,
        };

        let req_json = serde_json::to_value(&req_event).unwrap();
        let resp_json = serde_json::to_value(&resp_event).unwrap();
        assert_eq!(req_json["id"], resp_json["id"]);
    }

    // ─── Chain execution type tests ──────────────────────────────────────────

    #[test]
    fn chain_execution_request_event_serialises_camelcase() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());

        let event = ChainExecutionRequestEvent {
            request_id: "req-123".to_string(),
            chain_id: "chain-abc".to_string(),
            mapping_id: "map-1".to_string(),
            status: 200,
            headers,
            body: "{\"test\":true}".to_string(),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["requestId"], "req-123");
        assert_eq!(json["chainId"], "chain-abc");
        assert_eq!(json["mappingId"], "map-1");
        assert_eq!(json["status"], 200);
        assert_eq!(json["headers"]["content-type"], "application/json");
        assert_eq!(json["body"], "{\"test\":true}");
    }

    #[test]
    fn mapping_rule_deserialises_with_chain_fields() {
        let json = r#"{
            "id": "m1",
            "url_pattern": "api/data",
            "match_type": "partial",
            "enabled": true,
            "headers_add": [],
            "headers_remove": [],
            "cookies": [],
            "response_body_enabled": false,
            "response_body": "",
            "response_body_content_type": "application/json",
            "response_body_file_path": "",
            "url_remap_enabled": false,
            "url_remap_target": "",
            "use_chain": true,
            "chain_id": "chain-xyz"
        }"#;
        let rule: MappingRule = serde_json::from_str(json).unwrap();
        assert!(rule.use_chain);
        assert_eq!(rule.chain_id, Some("chain-xyz".to_string()));
    }

    #[test]
    fn mapping_rule_deserialises_without_chain_fields() {
        let json = r#"{
            "id": "m2",
            "url_pattern": "api/other",
            "match_type": "exact",
            "enabled": true,
            "headers_add": [],
            "headers_remove": [],
            "cookies": [],
            "response_body_enabled": false,
            "response_body": "",
            "response_body_content_type": "application/json",
            "response_body_file_path": "",
            "url_remap_enabled": false,
            "url_remap_target": ""
        }"#;
        let rule: MappingRule = serde_json::from_str(json).unwrap();
        assert!(!rule.use_chain);
        assert_eq!(rule.chain_id, None);
    }

    #[test]
    fn chain_registry_stores_and_retrieves_sender() {
        let registry: ChainRegistryRef = Arc::new(Mutex::new(HashMap::new()));
        let (tx, rx) = oneshot::channel::<Option<ChainExecutionResult>>();

        registry.lock().unwrap().insert("req-1".to_string(), tx);
        assert!(registry.lock().unwrap().contains_key("req-1"));

        let sender = registry.lock().unwrap().remove("req-1");
        assert!(sender.is_some());

        let result = ChainExecutionResult {
            status: 201,
            headers: HashMap::new(),
            body: "test".to_string(),
            body_content_type: "text/plain".to_string(),
        };
        let _ = sender.unwrap().send(Some(result));

        let received = rx.blocking_recv().unwrap();
        assert!(received.is_some());
        let r = received.unwrap();
        assert_eq!(r.status, 201);
        assert_eq!(r.body, "test");
        assert_eq!(r.body_content_type, "text/plain");
    }
}
