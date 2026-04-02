use super::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

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
    assert_eq!(rule.match_type, MatchType::Partial);
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
    assert_eq!(rule.match_type, MatchType::Partial);
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
    assert_eq!(rule.match_type, MatchType::Exact);
}

#[test]
fn chain_registry_stores_and_retrieves_sender() {
    let registry: ChainRegistryRef = Arc::new(Mutex::new(HashMap::new()));
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<ChainExecutionResult>>();

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

#[test]
fn match_type_deserialises_from_json_string() {
    let exact: MatchType = serde_json::from_str("\"exact\"").unwrap();
    let partial: MatchType = serde_json::from_str("\"partial\"").unwrap();
    let wildcard: MatchType = serde_json::from_str("\"wildcard\"").unwrap();
    let regex: MatchType = serde_json::from_str("\"regex\"").unwrap();
    assert_eq!(exact, MatchType::Exact);
    assert_eq!(partial, MatchType::Partial);
    assert_eq!(wildcard, MatchType::Wildcard);
    assert_eq!(regex, MatchType::Regex);
}

#[test]
fn match_type_serialises_to_lowercase() {
    assert_eq!(serde_json::to_string(&MatchType::Exact).unwrap(), "\"exact\"");
    assert_eq!(serde_json::to_string(&MatchType::Partial).unwrap(), "\"partial\"");
    assert_eq!(serde_json::to_string(&MatchType::Wildcard).unwrap(), "\"wildcard\"");
    assert_eq!(serde_json::to_string(&MatchType::Regex).unwrap(), "\"regex\"");
}
