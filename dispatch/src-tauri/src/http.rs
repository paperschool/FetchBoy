use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, Method, Url};
use serde::{Deserialize, Serialize};
use std::time::Instant;

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
pub struct SendRequestPayload {
    pub method: String,
    pub url: String,
    pub headers: Vec<KeyValueRow>,
    pub queryParams: Vec<KeyValueRow>,
    pub body: RequestBody,
    pub auth: RequestAuth,
}

// Read-only response header entry returned to the UI.
#[derive(Debug, Serialize)]
pub struct ResponseHeader {
    pub key: String,
    pub value: String,
}

// Response payload returned to the frontend for summary + tabs rendering.
#[derive(Debug, Serialize)]
pub struct SendResponsePayload {
    pub status: u16,
    pub statusText: String,
    pub responseTimeMs: u128,
    pub responseSizeBytes: usize,
    pub body: String,
    pub headers: Vec<ResponseHeader>,
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
pub async fn send_request(request: SendRequestPayload) -> Result<SendResponsePayload, String> {
    // Validate and normalize request parts before sending network traffic.
    let method = build_method(&request.method)?;
    let mut url = build_url(&request.url, &request.queryParams)?;
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

    // Build a reusable reqwest client with a sane default timeout.
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
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
    let response = request_builder
        .send()
        .await
        .map_err(|e| format!("Network request failed: {e}"))?;

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

    // Read response payload as text for initial raw-body support.
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {e}"))?;

    Ok(SendResponsePayload {
        status: status_code,
        statusText: status_text,
        responseTimeMs: started.elapsed().as_millis(),
        responseSizeBytes: body.len(),
        body,
        headers,
    })
}
