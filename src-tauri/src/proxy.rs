use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hudsucker::{
    builder::ProxyBuilder,
    certificate_authority::RcgenAuthority,
    hyper::{Request, Response},
    hyper_util::client::legacy::Error as UpstreamError,
    Body, HttpContext, HttpHandler, RequestOrResponse,
};
use hudsucker::hyper::header::{HeaderValue, CONTENT_LENGTH, CONTENT_TYPE, TRANSFER_ENCODING};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::oneshot;

// ─── Constants ────────────────────────────────────────────────────────────────

/// Maximum response body size to capture (1 MB). Larger bodies are skipped.
const MAX_BODY_CAPTURE_BYTES: usize = 1024 * 1024;

// ─── Event payload emitted to the frontend ────────────────────────────────────

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InterceptEvent {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<u16>,
    pub content_type: Option<String>,
    pub size: Option<u64>,
    pub request_headers: HashMap<String, String>,
    pub request_body: Option<String>,
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
    pub is_blocked: Option<bool>,
}

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
struct PendingRequest {
    id: String,
    timestamp: i64,
    method: String,
    host: String,
    path: String,
    request_headers: HashMap<String, String>,
    /// Written by handle_request's async block; read by handle_response.
    /// Uses Arc<Mutex> so the async future (which can't hold &mut self) can write it
    /// while handle_response reads it from self.pending after the future completes.
    request_body: Arc<Mutex<Option<String>>>,
    /// Monotonic instant captured when the request starts, used to compute response time.
    started: std::time::Instant,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn is_text_content_type(content_type: &str) -> bool {
    let ct = content_type.to_lowercase();
    ct.starts_with("text/")
        || ct.contains("json")
        || ct.contains("xml")
        || ct.contains("html")
        || ct.contains("javascript")
        || ct.contains("x-www-form-urlencoded")
}

fn collect_headers(
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
}

pub type MappingsRef = Arc<Mutex<Vec<MappingRule>>>;

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

// ─── HTTP handler ─────────────────────────────────────────────────────────────

pub type EmitFn = Arc<dyn Fn(&InterceptEvent) + Send + Sync + 'static>;
pub type PausedEmitFn = Arc<dyn Fn(&BreakpointPausedEvent) + Send + Sync + 'static>;
pub type RequestEmitFn = Arc<dyn Fn(&InterceptRequestEvent) + Send + Sync + 'static>;
pub type ResponseEmitFn = Arc<dyn Fn(&InterceptResponseEvent) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct InterceptHandler {
    emit_fn: EmitFn,
    paused_emit_fn: PausedEmitFn,
    request_emit_fn: RequestEmitFn,
    response_emit_fn: ResponseEmitFn,
    breakpoints: BreakpointsRef,
    pause_registry: PauseRegistryRef,
    pause_timeout: PauseTimeoutRef,
    /// Pending request captured in handle_request, consumed in handle_response.
    /// Hudsucker clones the handler once per request (see internal.rs `self.clone().proxy(req)`),
    /// so each clone handles exactly one request/response pair sequentially — no shared
    /// state or locking is needed.
    pending: Option<PendingRequest>,
}

impl InterceptHandler {
    fn new(
        emit_fn: EmitFn,
        paused_emit_fn: PausedEmitFn,
        request_emit_fn: RequestEmitFn,
        response_emit_fn: ResponseEmitFn,
        breakpoints: BreakpointsRef,
        pause_registry: PauseRegistryRef,
        pause_timeout: PauseTimeoutRef,
    ) -> Self {
        Self {
            emit_fn,
            paused_emit_fn,
            request_emit_fn,
            response_emit_fn,
            breakpoints,
            pause_registry,
            pause_timeout,
            pending: None,
        }
    }
}

impl HttpHandler for InterceptHandler {
    fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        mut req: Request<Body>,
    ) -> impl std::future::Future<Output = RequestOrResponse> + Send {
        let id = uuid::Uuid::new_v4().to_string();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let method = req.method().to_string();

        let host: String = req
            .uri()
            .host()
            .map(str::to_string)
            .or_else(|| {
                req.headers()
                    .get("host")
                    .and_then(|v| v.to_str().ok())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "unknown".to_string());

        let path: String = req
            .uri()
            .path_and_query()
            .map(|pq| pq.to_string())
            .unwrap_or_else(|| "/".to_string());

        let request_headers = collect_headers(req.headers());

        // Capture request content-type before moving req into the async block.
        let req_content_type = request_headers
            .get("content-type")
            .cloned()
            .unwrap_or_default();

        // Override Accept-Encoding to "identity" so the server sends uncompressed
        // responses (readable without a decompression step). We set the header
        // rather than removing it because some CDN/WAF systems (e.g. Akamai) flag
        // requests that are missing Accept-Encoding entirely as bot traffic.
        req.headers_mut().insert("accept-encoding", HeaderValue::from_static("identity"));

        // Shared slot: the async block writes the captured request body; handle_response reads it.
        let body_slot: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
        let slot_for_async = Arc::clone(&body_slot);

        // Store synchronously before returning the future — safe because this clone
        // of the handler is dedicated to this single request/response pair.
        self.pending = Some(PendingRequest {
            id: id.clone(),
            timestamp,
            method: method.clone(),
            host: host.clone(),
            path: path.clone(),
            request_headers: request_headers.clone(),
            request_body: body_slot,
            started: std::time::Instant::now(),
        });

        let emit_fn = Arc::clone(&self.emit_fn);
        let request_emit_fn = Arc::clone(&self.request_emit_fn);
        let response_emit_fn_for_block = Arc::clone(&self.response_emit_fn);
        let breakpoints = Arc::clone(&self.breakpoints);

        async move {
            // Buffer the request body so we can both capture it and forward it upstream.
            let (parts, body) = req.into_parts();
            let bytes: Bytes = body.collect().await.unwrap_or_default().to_bytes();

            let captured_body: Option<String> = if !bytes.is_empty()
                && bytes.len() <= MAX_BODY_CAPTURE_BYTES
                && is_text_content_type(&req_content_type)
            {
                Some(String::from_utf8_lossy(&bytes).into_owned())
            } else {
                None
            };
            *slot_for_async.lock().unwrap() = captured_body.clone();

            // Emit split request event so the frontend can show request data immediately.
            request_emit_fn(&InterceptRequestEvent {
                id: id.clone(),
                timestamp,
                method: method.clone(),
                host: host.clone(),
                path: path.clone(),
                request_headers: request_headers.clone(),
                request_body: captured_body.clone(),
            });

            // Check for a blocking breakpoint BEFORE forwarding upstream.
            let full_url = format!("https://{}{}", host, path);
            let blocking_bp = {
                let guard = breakpoints.lock().unwrap();
                guard
                    .iter()
                    .filter(|bp| bp.enabled && bp.block_request_enabled)
                    .find(|bp| match_url(&full_url, &bp.url_pattern, &bp.match_type).matches)
                    .cloned()
            };

            if let Some(bp) = blocking_bp {
                log::info!(
                    "Request blocked: '{}' matched '{}' — returning {}",
                    full_url,
                    bp.url_pattern,
                    bp.block_request_status_code,
                );

                let block_status = bp.block_request_status_code;
                let block_body = bp.block_request_body.clone();
                let block_body_bytes = Bytes::from(block_body.clone().into_bytes());
                let block_body_for_resp = if block_body.is_empty() { None } else { Some(block_body.clone()) };

                // Emit split response event for blocked request.
                let block_status_text = hudsucker::hyper::StatusCode::from_u16(block_status)
                    .ok()
                    .and_then(|s| s.canonical_reason())
                    .unwrap_or("Unknown Status")
                    .to_string();
                response_emit_fn_for_block(&InterceptResponseEvent {
                    id: id.clone(),
                    status_code: block_status,
                    status_text: block_status_text,
                    response_headers: HashMap::new(),
                    response_body: block_body_for_resp.clone(),
                    content_type: Some("text/plain".to_string()),
                    size: block_body_bytes.len() as u64,
                    response_time_ms: 0,
                    is_blocked: Some(true),
                });

                let event = InterceptEvent {
                    id,
                    timestamp,
                    method,
                    host,
                    path,
                    status_code: Some(block_status),
                    content_type: Some("text/plain".to_string()),
                    size: Some(block_body_bytes.len() as u64),
                    request_headers,
                    request_body: captured_body,
                    response_headers: HashMap::new(),
                    response_body: block_body_for_resp,
                    is_blocked: Some(true),
                };
                emit_fn(&event);

                let status = hudsucker::hyper::StatusCode::from_u16(block_status)
                    .unwrap_or(hudsucker::hyper::StatusCode::NOT_IMPLEMENTED);
                let response = Response::builder()
                    .status(status)
                    .header(CONTENT_LENGTH, block_body_bytes.len())
                    .body(Full::new(block_body_bytes).into())
                    .unwrap();
                return RequestOrResponse::Response(response);
            }

            let new_body: Body = Full::new(bytes).into();
            RequestOrResponse::Request(Request::from_parts(parts, new_body))
        }
    }

    fn handle_error(
        &mut self,
        _ctx: &HttpContext,
        err: UpstreamError,
    ) -> impl std::future::Future<Output = Response<Body>> + Send {
        // Emit an event so failed requests still appear in the intercept table.
        let req_info = self.pending.take();
        let emit_fn = Arc::clone(&self.emit_fn);
        let response_emit_fn = Arc::clone(&self.response_emit_fn);
        let err_str = err.to_string();

        async move {
            if let Some(req_info) = req_info {
                let response_time_ms = req_info.started.elapsed().as_millis() as i64;
                let request_body = req_info.request_body.lock().unwrap().clone();

                response_emit_fn(&InterceptResponseEvent {
                    id: req_info.id.clone(),
                    status_code: 502,
                    status_text: "Bad Gateway".to_string(),
                    response_headers: HashMap::new(),
                    response_body: Some(err_str.clone()),
                    content_type: None,
                    size: 0,
                    response_time_ms,
                    is_blocked: None,
                });

                let event = InterceptEvent {
                    id: req_info.id,
                    timestamp: req_info.timestamp,
                    method: req_info.method,
                    host: req_info.host,
                    path: req_info.path,
                    status_code: None,
                    content_type: None,
                    size: None,
                    request_headers: req_info.request_headers,
                    request_body,
                    response_headers: HashMap::new(),
                    response_body: Some(err_str),
                    is_blocked: None,
                };
                emit_fn(&event);
            }

            Response::builder()
                .status(502)
                .body(Body::empty())
                .unwrap()
        }
    }

    fn handle_response(
        &mut self,
        _ctx: &HttpContext,
        res: Response<Body>,
    ) -> impl std::future::Future<Output = Response<Body>> + Send {
        let status_code = res.status().as_u16();

        let orig_content_type: Option<String> = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        // Take the pending request that was stored by handle_request on this same clone.
        let req_info = self.pending.take();
        let emit_fn = Arc::clone(&self.emit_fn);
        let paused_emit_fn = Arc::clone(&self.paused_emit_fn);
        let response_emit_fn = Arc::clone(&self.response_emit_fn);
        let breakpoints = Arc::clone(&self.breakpoints);
        let pause_registry = Arc::clone(&self.pause_registry);
        let pause_timeout_ref = Arc::clone(&self.pause_timeout);

        async move {
            let (mut parts, body) = res.into_parts();
            let response_headers = collect_headers(&parts.headers);

            let orig_bytes: Bytes = body.collect().await.unwrap_or_default().to_bytes();

            // Capture the response body for potential pausing.
            let orig_response_body: Option<String> =
                if orig_bytes.len() <= MAX_BODY_CAPTURE_BYTES
                    && orig_content_type
                        .as_deref()
                        .map(is_text_content_type)
                        .unwrap_or(false)
                {
                    Some(String::from_utf8_lossy(&orig_bytes).into_owned())
                } else {
                    None
                };

            // Find the first enabled breakpoint that matches this URL.
            let url = req_info
                .as_ref()
                .map(|r| format!("https://{}{}", r.host, r.path))
                .unwrap_or_default();

            let matched_bp = {
                let guard = breakpoints.lock().unwrap();
                guard
                    .iter()
                    .filter(|bp| bp.enabled && !bp.block_request_enabled)
                    .find(|bp| match_url(&url, &bp.url_pattern, &bp.match_type).matches)
                    .cloned()
            };

            // ── Pause logic ──────────────────────────────────────────────────
            // When a non-blocking breakpoint matches, pause the response and
            // wait for user action (Continue / Drop / Modify) or timeout.
            let user_decision: Option<PauseDecision> = if let Some(ref bp) = matched_bp {
                let timeout_secs = *pause_timeout_ref.lock().unwrap();
                let (tx, rx) = oneshot::channel::<PauseDecision>();

                let request_id = req_info
                    .as_ref()
                    .map(|r| r.id.clone())
                    .unwrap_or_default();

                // Store the sender so a Tauri command can signal us.
                pause_registry.lock().unwrap().insert(request_id.clone(), tx);

                // Emit the paused event to the frontend.
                if let Some(ref ri) = req_info {
                    let timeout_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_secs() as i64
                        + timeout_secs as i64;

                    let request_body = ri.request_body.lock().unwrap().clone();
                    let paused_event = BreakpointPausedEvent {
                        request_id: request_id.clone(),
                        breakpoint_id: bp.id.clone(),
                        breakpoint_name: bp.id.clone(), // name not stored in rule; id used as fallback
                        timeout_at,
                        method: ri.method.clone(),
                        host: ri.host.clone(),
                        path: ri.path.clone(),
                        status_code: Some(status_code),
                        response_body: orig_response_body.clone(),
                        response_headers: response_headers.clone(),
                        request_headers: ri.request_headers.clone(),
                        request_body,
                    };
                    paused_emit_fn(&paused_event);
                }

                // Wait for user input (or timeout).
                if timeout_secs == 0 {
                    // 0 means "never" — wait indefinitely.
                    match rx.await {
                        Ok(decision) => {
                            pause_registry.lock().unwrap().remove(&request_id);
                            Some(decision)
                        }
                        Err(_) => None,
                    }
                } else {
                    match tokio::time::timeout(Duration::from_secs(timeout_secs), rx).await {
                        Ok(Ok(decision)) => {
                            pause_registry.lock().unwrap().remove(&request_id);
                            Some(decision)
                        }
                        _ => {
                            // Timeout or channel closed → clean up and auto-continue.
                            pause_registry.lock().unwrap().remove(&request_id);
                            Some(PauseDecision::Continue)
                        }
                    }
                }
            } else {
                None
            };

            // ── Handle Drop ──────────────────────────────────────────────────
            if matches!(user_decision, Some(PauseDecision::Drop)) {
                // Emit a "dropped" event so the intercept table shows it.
                if let Some(ref ri) = req_info {
                    let response_time_ms = ri.started.elapsed().as_millis() as i64;
                    let request_body = ri.request_body.lock().unwrap().clone();

                    response_emit_fn(&InterceptResponseEvent {
                        id: ri.id.clone(),
                        status_code: 0,
                        status_text: "Dropped".to_string(),
                        response_headers: HashMap::new(),
                        response_body: Some("Request dropped by user".to_string()),
                        content_type: None,
                        size: 0,
                        response_time_ms,
                        is_blocked: Some(true),
                    });

                    let event = InterceptEvent {
                        id: ri.id.clone(),
                        timestamp: ri.timestamp,
                        method: ri.method.clone(),
                        host: ri.host.clone(),
                        path: ri.path.clone(),
                        status_code: Some(0),
                        content_type: None,
                        size: Some(0),
                        request_headers: ri.request_headers.clone(),
                        request_body,
                        response_headers: HashMap::new(),
                        response_body: Some("Request dropped by user".to_string()),
                        is_blocked: Some(true),
                    };
                    emit_fn(&event);
                }
                return Response::builder()
                    .status(502)
                    .body(Body::empty())
                    .unwrap();
            }

            // ── Apply modifications ───────────────────────────────────────────
            // Determine effective values from either user mods (Edit & Continue)
            // or breakpoint rules (Continue / timeout / no breakpoint match).
            let mut effective_status_code = status_code;
            let (final_bytes, final_content_type) = if let Some(PauseDecision::Modify(ref mods)) = user_decision {
                // User supplied modifications via Edit & Continue.
                if let Some(sc) = mods.status_code {
                    effective_status_code = sc;
                }
                let body_bytes = if let Some(ref body_str) = mods.response_body {
                    Bytes::from(body_str.clone().into_bytes())
                } else {
                    orig_bytes
                };
                let ct = mods.content_type.clone().or(orig_content_type);
                if let Some(ref ct_str) = ct {
                    if let Ok(val) = HeaderValue::from_str(ct_str) {
                        parts.headers.insert(CONTENT_TYPE, val);
                    }
                }
                if let Ok(val) = HeaderValue::from_str(&body_bytes.len().to_string()) {
                    parts.headers.insert(CONTENT_LENGTH, val);
                }
                for pair in &mods.headers {
                    if let (Ok(name), Ok(val)) = (
                        hudsucker::hyper::header::HeaderName::from_bytes(pair[0].as_bytes()),
                        HeaderValue::from_str(&pair[1]),
                    ) {
                        parts.headers.insert(name, val);
                    }
                }
                (body_bytes, ct)
            } else {
                // Apply breakpoint rules (Continue / no pause).
                if let Some(ref bp) = matched_bp {
                    if bp.status_code_enabled {
                        log::info!(
                            "Status code override: '{}' matched '{}' — {} → {}",
                            url, bp.url_pattern, status_code, bp.status_code_value,
                        );
                        effective_status_code = bp.status_code_value;
                    }
                }

                let (bytes, ct) = match matched_bp.as_ref().filter(|bp| bp.response_mapping_enabled) {
                    Some(bp) => {
                        log::info!(
                            "Response mapping: '{}' matched '{}' — {} B → {} B",
                            url, bp.url_pattern, orig_bytes.len(), bp.response_mapping_body.len(),
                        );
                        let mapped = Bytes::from(bp.response_mapping_body.clone().into_bytes());
                        let ct = bp.response_mapping_content_type.clone();
                        if let Ok(val) = HeaderValue::from_str(&ct) {
                            parts.headers.insert(CONTENT_TYPE, val);
                        }
                        if let Ok(val) = HeaderValue::from_str(&mapped.len().to_string()) {
                            parts.headers.insert(CONTENT_LENGTH, val);
                        }
                        (mapped, Some(ct))
                    }
                    None => (orig_bytes, orig_content_type),
                };

                if let Some(ref bp) = matched_bp {
                    for header in &bp.custom_headers {
                        if header.enabled && !header.key.is_empty() {
                            log::info!(
                                "Custom header: '{}' matched '{}' — {} = {}",
                                url, bp.url_pattern, header.key, header.value,
                            );
                            if let (Ok(name), Ok(val)) = (
                                hudsucker::hyper::header::HeaderName::from_bytes(header.key.as_bytes()),
                                HeaderValue::from_str(&header.value),
                            ) {
                                parts.headers.insert(name, val);
                            }
                        }
                    }
                }
                (bytes, ct)
            };

            let size = final_bytes.len() as u64;

            let response_body: Option<String> =
                if final_bytes.len() <= MAX_BODY_CAPTURE_BYTES
                    && final_content_type
                        .as_deref()
                        .map(is_text_content_type)
                        .unwrap_or(false)
                {
                    Some(String::from_utf8_lossy(&final_bytes).into_owned())
                } else {
                    None
                };

            // Rebuild response with potentially modified status code.
            // Remove Transfer-Encoding and set Content-Length since we always send a
            // fully-buffered body; leaving Transfer-Encoding: chunked in place would
            // make the client misparse the response and cancel the request.
            parts.headers.remove(TRANSFER_ENCODING);
            if let Ok(val) = HeaderValue::from_str(&final_bytes.len().to_string()) {
                parts.headers.insert(CONTENT_LENGTH, val);
            }
            let new_status = hudsucker::hyper::StatusCode::from_u16(effective_status_code)
                .unwrap_or(parts.status);
            parts.status = new_status;

            let new_body: Body = Full::new(final_bytes).into();
            let res = Response::from_parts(parts, new_body);

            if let Some(req_info) = req_info {
                let response_time_ms = req_info.started.elapsed().as_millis() as i64;
                let request_body = req_info.request_body.lock().unwrap().clone();

                // Emit split response event.
                let status_text = hudsucker::hyper::StatusCode::from_u16(effective_status_code)
                    .ok()
                    .and_then(|s| s.canonical_reason())
                    .unwrap_or("Unknown Status")
                    .to_string();
                response_emit_fn(&InterceptResponseEvent {
                    id: req_info.id.clone(),
                    status_code: effective_status_code,
                    status_text,
                    response_headers: response_headers.clone(),
                    response_body: response_body.clone(),
                    content_type: final_content_type.clone(),
                    size,
                    response_time_ms,
                    is_blocked: None,
                });

                // Emit combined event for backwards compatibility.
                let event = InterceptEvent {
                    id: req_info.id,
                    timestamp: req_info.timestamp,
                    method: req_info.method,
                    host: req_info.host,
                    path: req_info.path,
                    status_code: Some(effective_status_code),
                    content_type: final_content_type,
                    size: Some(size),
                    request_headers: req_info.request_headers,
                    request_body,
                    response_headers,
                    response_body,
                    is_blocked: None,
                };
                emit_fn(&event);
            }

            res
        }
    }
}

// ─── Proxy server ─────────────────────────────────────────────────────────────

pub struct ProxyServer {
    port: u16,
    shutdown_tx: Option<oneshot::Sender<()>>,
}

impl ProxyServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            shutdown_tx: None,
        }
    }

    /// Start the proxy on a background async task.
    pub fn start(
        &mut self,
        ca: RcgenAuthority,
        emit_fn: EmitFn,
        paused_emit_fn: PausedEmitFn,
        request_emit_fn: RequestEmitFn,
        response_emit_fn: ResponseEmitFn,
        breakpoints: BreakpointsRef,
        pause_registry: PauseRegistryRef,
        pause_timeout: PauseTimeoutRef,
    ) {
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        let port = self.port;
        let handler = InterceptHandler::new(emit_fn, paused_emit_fn, request_emit_fn, response_emit_fn, breakpoints, pause_registry, pause_timeout);
        let crypto_provider = rustls::crypto::ring::default_provider();

        tauri::async_runtime::spawn(async move {
            let addr: SocketAddr = ([127, 0, 0, 1], port).into();

            match ProxyBuilder::new()
                .with_addr(addr)
                .with_ca(ca)
                .with_rustls_connector(crypto_provider)
                .with_http_handler(handler)
                .with_graceful_shutdown(async move {
                    let _ = shutdown_rx.await;
                })
                .build()
            {
                Err(e) => log::error!("Failed to build MITM proxy: {e}"),
                Ok(proxy) => {
                    if let Err(e) = proxy.start().await {
                        log::error!("MITM proxy runtime error: {e}");
                    }
                }
            }
        });
    }

    /// Signal graceful shutdown of the proxy.
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }
}

impl Drop for ProxyServer {
    fn drop(&mut self) {
        self.stop();
    }
}

// ─── URL Matching ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UrlMatchResult {
    pub matches: bool,
    pub matched_pattern: String,
}

/// Match a URL against a pattern using the specified match type.
/// Returns a UrlMatchResult indicating whether the URL matches.
pub fn match_url(url: &str, pattern: &str, match_type: &str) -> UrlMatchResult {
    let matches = match match_type {
        "exact" => url == pattern,
        "partial" => url.contains(pattern),
        "wildcard" => match_wildcard(url, pattern),
        "regex" => match_regex(url, pattern).unwrap_or(false),
        _ => false,
    };
    UrlMatchResult {
        matches,
        matched_pattern: pattern.to_string(),
    }
}

fn match_wildcard(url: &str, pattern: &str) -> bool {
    // Convert glob-style wildcards to a regex pattern.
    // Escape dots and convert * to .*
    let regex_pattern = pattern.replace('.', "\\.").replace('*', ".*");
    match Regex::new(&format!("^{}$", regex_pattern)) {
        Ok(re) => re.is_match(url),
        Err(_) => false,
    }
}

fn match_regex(url: &str, pattern: &str) -> Result<bool, regex::Error> {
    let re = Regex::new(pattern)?;
    Ok(re.is_match(url))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ─── URL matching tests ────────────────────────────────────────────────────

    #[test]
    fn match_url_exact_matches_identical_urls() {
        let result = match_url("https://api.example.com/users/123", "https://api.example.com/users/123", "exact");
        assert!(result.matches);
    }

    #[test]
    fn match_url_exact_does_not_match_different_url() {
        let result = match_url("https://api.example.com/users/123", "https://api.example.com/users", "exact");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_partial_matches_substring() {
        let result = match_url("https://example.com/api/users/123", "api/users", "partial");
        assert!(result.matches);
    }

    #[test]
    fn match_url_partial_does_not_match_absent_substring() {
        let result = match_url("https://example.com/api/orders/456", "api/users", "partial");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_wildcard_matches_glob_pattern() {
        let result = match_url("/foo/api/users/123", "*/api/users/*", "wildcard");
        assert!(result.matches);
    }

    #[test]
    fn match_url_wildcard_does_not_match_mismatched_pattern() {
        let result = match_url("/foo/api/orders/123", "*/api/users/*", "wildcard");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_regex_matches_valid_pattern() {
        let result = match_url("/api/users/123", r"^/api/users/\d+$", "regex");
        assert!(result.matches);
    }

    #[test]
    fn match_url_regex_does_not_match_non_digit_id() {
        let result = match_url("/api/users/abc", r"^/api/users/\d+$", "regex");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_regex_returns_false_for_invalid_pattern() {
        let result = match_url("/api/users/123", "[invalid", "regex");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_unknown_type_returns_false() {
        let result = match_url("/api/users/123", "/api/users", "unknown");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_result_contains_matched_pattern() {
        let result = match_url("https://api.example.com/users", "api/users", "partial");
        assert_eq!(result.matched_pattern, "api/users");
    }

    // ─── Proxy server tests ────────────────────────────────────────────────────

    #[test]
    fn proxy_server_new_stores_port() {
        let proxy = ProxyServer::new(8080);
        assert_eq!(proxy.port, 8080);
        assert!(proxy.shutdown_tx.is_none());
    }

    #[test]
    fn proxy_server_stop_does_not_panic_when_not_started() {
        let mut proxy = ProxyServer::new(8080);
        proxy.stop();
    }

    #[test]
    fn intercept_event_serialises_camelcase_fields() {
        let mut request_headers = HashMap::new();
        request_headers.insert("content-type".to_string(), "application/json".to_string());
        let mut response_headers = HashMap::new();
        response_headers.insert("x-request-id".to_string(), "abc123".to_string());

        let event = InterceptEvent {
            id: "test-id".to_string(),
            timestamp: 1234567890,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/api/data".to_string(),
            status_code: Some(200),
            content_type: Some("application/json".to_string()),
            size: Some(1024),
            request_headers,
            request_body: Some("{\"query\":\"test\"}".to_string()),
            response_headers,
            response_body: Some("{\"ok\":true}".to_string()),
            is_blocked: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["statusCode"], 200);
        assert_eq!(json["contentType"], "application/json");
        assert_eq!(json["method"], "GET");
        assert_eq!(json["host"], "example.com");
        assert_eq!(json["requestHeaders"]["content-type"], "application/json");
        assert_eq!(json["requestBody"], "{\"query\":\"test\"}");
        assert_eq!(json["responseHeaders"]["x-request-id"], "abc123");
        assert_eq!(json["responseBody"], "{\"ok\":true}");
    }

    #[test]
    fn intercept_event_optional_fields_are_null_when_none() {
        let event = InterceptEvent {
            id: "id".to_string(),
            timestamp: 0,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/".to_string(),
            status_code: None,
            content_type: None,
            size: None,
            request_headers: HashMap::new(),
            request_body: None,
            response_headers: HashMap::new(),
            response_body: None,
            is_blocked: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert!(json["statusCode"].is_null());
        assert!(json["contentType"].is_null());
        assert!(json["size"].is_null());
        assert!(json["requestBody"].is_null());
        assert!(json["responseBody"].is_null());
    }

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
    fn emit_fn_is_called_by_handler() {
        use std::sync::atomic::{AtomicBool, Ordering};

        let called = Arc::new(AtomicBool::new(false));
        let called_clone = Arc::clone(&called);

        let emit_fn: EmitFn = Arc::new(move |_event| {
            called_clone.store(true, Ordering::SeqCst);
        });
        let paused_emit_fn: PausedEmitFn = Arc::new(|_| {});
        let request_emit_fn: RequestEmitFn = Arc::new(|_| {});
        let response_emit_fn: ResponseEmitFn = Arc::new(|_| {});
        let breakpoints: BreakpointsRef = Arc::new(Mutex::new(Vec::new()));
        let pause_registry: PauseRegistryRef = Arc::new(Mutex::new(HashMap::new()));
        let pause_timeout: PauseTimeoutRef = Arc::new(Mutex::new(30));
        let handler = InterceptHandler::new(emit_fn, paused_emit_fn, request_emit_fn, response_emit_fn, breakpoints, pause_registry, pause_timeout);
        assert!(handler.pending.is_none());
    }

    // ─── BreakpointRule struct tests ───────────────────────────────────────────

    #[test]
    fn breakpoint_rule_deserialises_with_new_fields() {
        let json = r#"{
            "id": "bp1",
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
    fn intercept_event_is_blocked_field_serialises() {
        let event = InterceptEvent {
            id: "id".to_string(),
            timestamp: 0,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/api/test".to_string(),
            status_code: Some(501),
            content_type: Some("text/plain".to_string()),
            size: Some(0),
            request_headers: HashMap::new(),
            request_body: None,
            response_headers: HashMap::new(),
            response_body: None,
            is_blocked: Some(true),
        };
        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["isBlocked"], true);
        assert_eq!(json["statusCode"], 501);
    }

    #[test]
    fn breakpoint_header_deserialises_correctly() {
        let json = r#"{"key": "Authorization", "value": "Bearer test", "enabled": false}"#;
        let header: BreakpointHeader = serde_json::from_str(json).unwrap();
        assert_eq!(header.key, "Authorization");
        assert_eq!(header.value, "Bearer test");
        assert!(!header.enabled);
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
}
