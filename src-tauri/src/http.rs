use base64::Engine as _;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use tokio::sync::oneshot;

pub struct CancellationRegistry(pub Mutex<HashMap<String, oneshot::Sender<()>>>);

// Shared key/value representation for headers and query params from the frontend.
#[derive(Debug, Deserialize)]
pub struct KeyValueRow {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

// Request body payload currently supports raw mode for MVP story scope.
#[derive(Debug, Deserialize)]
pub struct RequestBody {
    #[allow(dead_code)] // deserialized from frontend JSON but only `raw` is used in Rust
    pub mode: String,
    pub raw: String,
}

// Auth payload supporting all four auth variants (none, bearer, basic, api-key).
#[derive(Debug, Deserialize)]
pub struct RequestAuth {
    pub r#type: String,
    pub token: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub key: Option<String>,
    pub value: Option<String>,
    pub r#in: Option<String>,
}

// Input payload received from invoke("send_request", { request: ... }).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendRequestPayload {
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValueRow>,
    pub query_params: Vec<KeyValueRow>,
    pub body: RequestBody,
    pub auth: RequestAuth,
    pub timeout_ms: u64,
    pub ssl_verify: bool,
    pub request_id: Option<String>,
}

// Read-only response header entry returned to the UI.
#[derive(Debug, Serialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

// Response payload returned to the frontend for summary + tabs rendering.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendResponsePayload {
    pub status: u16,
    pub status_text: String,
    pub response_time_ms: u128,
    pub response_size_bytes: usize,
    pub body: String,           // base64 encoded for binary, text for text
    pub headers: Vec<ResponseHeader>,
    pub content_type: Option<String>,  // Content-Type header value
}

// Check if the content type should be treated as binary (read as bytes and base64-encoded).
fn is_binary_content_type(content_type: &str) -> bool {
    let ct = content_type.to_lowercase();
    ct.starts_with("image/") || ct == "application/octet-stream" || ct == "application/pdf"
}

// Parse HTTP verb safely from user-provided string.
fn build_method(method: &str) -> Result<Method, String> {
    Method::from_bytes(method.as_bytes()).map_err(|_| format!("Unsupported HTTP method: {method}"))
}

// Parse the base URL and append enabled query params.
fn build_url(base_url: &str, query_params: &[KeyValueRow]) -> Result<Url, String> {
    let mut url = Url::parse(base_url).map_err(|e| format!("Invalid URL: {e}"))?;

    {
        let mut pairs = url.query_pairs_mut();
        for param in query_params {
            if param.enabled && !param.key.trim().is_empty() {
                pairs.append_pair(&param.key, &param.value);
            }
        }
    }

    Ok(url)
}

// Convert enabled UI header rows into reqwest HeaderMap.
fn build_headers(headers: &[KeyValueRow]) -> Result<HeaderMap, String> {
    let mut header_map = HeaderMap::new();

    for header in headers {
        if !header.enabled || header.key.trim().is_empty() {
            continue;
        }

        let name = HeaderName::from_bytes(header.key.as_bytes())
            .map_err(|_| format!("Invalid header name: {}", header.key))?;
        let value = HeaderValue::from_str(&header.value)
            .map_err(|_| format!("Invalid header value for '{}': contains unsupported characters", header.key))?;

        header_map.insert(name, value);
    }

    Ok(header_map)
}

#[tauri::command]
pub async fn send_request(
    request: SendRequestPayload,
    state: tauri::State<'_, CancellationRegistry>,
) -> Result<SendResponsePayload, String> {
    // Validate and normalize request parts before sending network traffic.
    let method = build_method(&request.method)?;
    let mut url = build_url(&request.url, &request.query_params)?;
    let headers = build_headers(&request.headers)?;

    // Inject API Key query param into URL BEFORE building the request builder.
    if request.auth.r#type == "api-key" {
        if request.auth.r#in.as_deref() == Some("query") {
            let key = request.auth.key.as_deref().unwrap_or("");
            let value = request.auth.value.as_deref().unwrap_or("");
            if !key.is_empty() {
                url.query_pairs_mut().append_pair(key, value);
            }
        }
    }

    // Build a reusable reqwest client with user-configured timeout and SSL settings.
    // timeout_ms == 0 means no timeout; skip setting timeout on the client.
    let mut client_builder = Client::builder()
        .danger_accept_invalid_certs(!request.ssl_verify);
    if request.timeout_ms > 0 {
        client_builder = client_builder.timeout(std::time::Duration::from_millis(request.timeout_ms));
    }
    let client = client_builder
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let mut request_builder = client.request(method, url).headers(headers);

    // Inject bearer / basic / api-key header auth.
    match request.auth.r#type.as_str() {
        "bearer" => {
            let token = request.auth.token.as_deref().unwrap_or("");
            request_builder = request_builder.bearer_auth(token);
        }
        "basic" => {
            let username = request.auth.username.as_deref().unwrap_or("");
            let password = request.auth.password.as_deref().unwrap_or("");
            request_builder = request_builder.basic_auth(username, Some(password));
        }
        "api-key" => {
            // Only inject as header when in == "header" (query was handled above via URL).
            if request.auth.r#in.as_deref().unwrap_or("header") == "header" {
                let key = request.auth.key.as_deref().unwrap_or("").to_string();
                let value = request.auth.value.as_deref().unwrap_or("").to_string();
                if !key.is_empty() {
                    let name = HeaderName::from_bytes(key.as_bytes())
                        .map_err(|_| format!("Invalid API Key header name: {key}"))?;
                    let val = HeaderValue::from_str(&value)
                        .map_err(|_| format!("Invalid API Key header value: {value}"))?;
                    request_builder = request_builder.header(name, val);
                }
            }
        }
        "none" | "" => {} // No auth
        other => return Err(format!("Unsupported auth type: {other}")),
    }

    // Attach raw body only when provided.
    if !request.body.raw.trim().is_empty() {
        request_builder = request_builder.body(request.body.raw);
    }

    // Track elapsed time for response diagnostics in the UI.
    let started = Instant::now();

    // If a request_id was provided, register a cancellation channel and race the request against it.
    let response = if let Some(ref request_id) = request.request_id {
        let (tx, rx) = oneshot::channel::<()>();
        {
            let mut map = state.0.lock().map_err(|e| e.to_string())?;
            map.insert(request_id.clone(), tx);
        }

        let result = tokio::select! {
            res = request_builder.send() => {
                // Cleanup registry entry on normal completion.
                let mut map = state.0.lock().map_err(|e| e.to_string())?;
                map.remove(request_id);
                res.map_err(|e| {
                    if e.is_timeout() { "__TIMEOUT__".to_string() }
                    else { format!("Network request failed: {e}") }
                })
            }
            _ = rx => {
                // Cleanup registry entry on cancellation.
                let mut map = state.0.lock().map_err(|e| e.to_string())?;
                map.remove(request_id);
                return Err("__CANCELLED__".to_string());
            }
        };
        result?
    } else {
        request_builder
            .send()
            .await
            .map_err(|e| {
                if e.is_timeout() { "__TIMEOUT__".to_string() }
                else { format!("Network request failed: {e}") }
            })?
    };

    let status = response.status();
    let status_code = status.as_u16();
    let status_text = status
        .canonical_reason()
        .unwrap_or("Unknown Status")
        .to_string();

    // Snapshot all response headers as plain strings for frontend rendering.
    let headers: Vec<ResponseHeader> = response
        .headers()
        .iter()
        .map(|(key, value)| ResponseHeader {
            key: key.to_string(),
            value: value.to_str().unwrap_or("").to_string(),
        })
        .collect();

    // Extract content-type before consuming the response body.
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    // Read binary responses as base64-encoded bytes; text responses as UTF-8 strings.
    let (body, response_size) = if content_type
        .as_ref()
        .map(|ct| is_binary_content_type(ct))
        .unwrap_or(false)
    {
        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read response body: {e}"))?;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
        let size = bytes.len();
        (encoded, size)
    } else {
        let text = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response body: {e}"))?;
        let size = text.len();
        (text, size)
    };

    Ok(SendResponsePayload {
        status: status_code,
        status_text,
        response_time_ms: started.elapsed().as_millis(),
        response_size_bytes: response_size,
        body,
        headers,
        content_type,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_binary_content_type_returns_true_for_images() {
        assert!(is_binary_content_type("image/png"));
        assert!(is_binary_content_type("image/jpeg"));
        assert!(is_binary_content_type("image/gif"));
        assert!(is_binary_content_type("image/webp"));
        assert!(is_binary_content_type("image/svg+xml"));
    }

    #[test]
    fn is_binary_content_type_returns_true_for_pdf_and_octet_stream() {
        assert!(is_binary_content_type("application/pdf"));
        assert!(is_binary_content_type("application/octet-stream"));
    }

    #[test]
    fn is_binary_content_type_returns_false_for_text_types() {
        assert!(!is_binary_content_type("application/json"));
        assert!(!is_binary_content_type("text/plain"));
        assert!(!is_binary_content_type("text/html"));
        assert!(!is_binary_content_type("application/xml"));
    }

    #[test]
    fn is_binary_content_type_is_case_insensitive() {
        assert!(is_binary_content_type("Image/PNG"));
        assert!(is_binary_content_type("APPLICATION/PDF"));
    }
}

#[tauri::command]
pub async fn cancel_request(
    request_id: String,
    state: tauri::State<'_, CancellationRegistry>,
) -> Result<(), String> {
    let mut map = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = map.remove(&request_id) {
        let _ = sender.send(());
    }
    Ok(())
}
