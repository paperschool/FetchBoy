use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hudsucker::{
    hyper::{Request, Response},
    hyper_util::client::legacy::Error as UpstreamError,
    Body, HttpContext, HttpHandler, RequestOrResponse,
};
use hudsucker::hyper::header::{HeaderValue, CONTENT_LENGTH, CONTENT_TYPE, TRANSFER_ENCODING};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::sync::oneshot;

use super::types::*;
use super::url_matching::match_url;

// ─── HTTP handler ─────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct InterceptHandler {
    paused_emit_fn: PausedEmitFn,
    request_emit_fn: RequestEmitFn,
    response_emit_fn: ResponseEmitFn,
    mapping_emit_fn: MappingEmitFn,
    breakpoints: BreakpointsRef,
    mappings: MappingsRef,
    pause_registry: PauseRegistryRef,
    pause_timeout: PauseTimeoutRef,
    /// Pending request captured in handle_request, consumed in handle_response.
    /// Hudsucker clones the handler once per request (see internal.rs `self.clone().proxy(req)`),
    /// so each clone handles exactly one request/response pair sequentially — no shared
    /// state or locking is needed.
    pub(crate) pending: Option<PendingRequest>,
}

impl InterceptHandler {
    pub(crate) fn new(
        paused_emit_fn: PausedEmitFn,
        request_emit_fn: RequestEmitFn,
        response_emit_fn: ResponseEmitFn,
        mapping_emit_fn: MappingEmitFn,
        breakpoints: BreakpointsRef,
        mappings: MappingsRef,
        pause_registry: PauseRegistryRef,
        pause_timeout: PauseTimeoutRef,
    ) -> Self {
        Self {
            paused_emit_fn,
            request_emit_fn,
            response_emit_fn,
            mapping_emit_fn,
            breakpoints,
            mappings,
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

        let request_emit_fn = Arc::clone(&self.request_emit_fn);
        let response_emit_fn_for_block = Arc::clone(&self.response_emit_fn);
        let mapping_emit_fn_for_remap = Arc::clone(&self.mapping_emit_fn);
        let breakpoints = Arc::clone(&self.breakpoints);
        let mappings_for_remap = Arc::clone(&self.mappings);

        async move {
            // Buffer the request body so we can both capture it and forward it upstream.
            let (mut parts, body) = req.into_parts();
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

            // ── URL Remapping ──────────────────────────────────────────────
            // Check mapping rules for URL remap BEFORE forwarding upstream.
            let full_url = format!("https://{}{}", host, path);
            {
                let remap_rule = {
                    let guard = mappings_for_remap.lock().unwrap();
                    guard
                        .iter()
                        .filter(|m| m.enabled && m.url_remap_enabled && !m.url_remap_target.is_empty())
                        .find(|m| match_url(&full_url, &m.url_pattern, &m.match_type).matches)
                        .cloned()
                };

                if let Some(ref rule) = remap_rule {
                    if let Ok(target) = rule.url_remap_target.parse::<hudsucker::hyper::Uri>() {
                        let new_host = target.host().unwrap_or("localhost").to_string();
                        let target_path = target.path();
                        // Preserve the original path by appending it to the target base
                        let new_path = if target_path == "/" || target_path.is_empty() {
                            path.clone()
                        } else {
                            format!("{}{}", target_path.trim_end_matches('/'), path)
                        };
                        let scheme = target.scheme_str().unwrap_or("https");
                        let port_str = target.port().map(|p| format!(":{}", p)).unwrap_or_default();
                        let new_uri = format!("{scheme}://{new_host}{port_str}{new_path}");

                        log::info!(
                            "URL remap: '{}' → '{}' (mapping '{}')",
                            full_url, new_uri, rule.id,
                        );

                        if let Ok(uri) = new_uri.parse::<hudsucker::hyper::Uri>() {
                            parts.uri = uri;
                        }
                        if let Ok(val) = HeaderValue::from_str(&new_host) {
                            parts.headers.insert("host", val);
                        }

                        // Emit mapping:applied event for the remap
                        let ts = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                        mapping_emit_fn_for_remap(&MappingAppliedEvent {
                            mapping_id: rule.id.clone(),
                            mapping_name: rule.id.clone(),
                            request_id: id.clone(),
                            timestamp: ts,
                            overrides_applied: vec!["url_remap".to_string()],
                            original_url: Some(full_url.clone()),
                            remapped_url: Some(new_uri),
                        });
                    }
                }
            }

            // Check for a blocking breakpoint BEFORE forwarding upstream.
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
        let paused_emit_fn = Arc::clone(&self.paused_emit_fn);
        let response_emit_fn = Arc::clone(&self.response_emit_fn);
        let mapping_emit_fn = Arc::clone(&self.mapping_emit_fn);
        let breakpoints = Arc::clone(&self.breakpoints);
        let mappings = Arc::clone(&self.mappings);
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
                        breakpoint_name: bp.name.clone(),
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

            // ── Apply request mappings (AFTER breakpoint processing) ─────────
            let (mut final_bytes, mut final_content_type) = (final_bytes, final_content_type);
            let bp_replaced_body = matched_bp.as_ref().is_some_and(|bp| bp.response_mapping_enabled);
            {
                let matched_mapping = {
                    let guard = mappings.lock().unwrap();
                    guard
                        .iter()
                        .filter(|m| m.enabled)
                        .find(|m| match_url(&url, &m.url_pattern, &m.match_type).matches)
                        .cloned()
                };

                if let Some(ref mapping) = matched_mapping {
                    let mut overrides: Vec<String> = Vec::new();
                    let request_id = req_info.as_ref().map(|r| r.id.clone()).unwrap_or_default();

                    // Add headers (skip if breakpoint already set them)
                    for h in &mapping.headers_add {
                        if h.enabled && !h.key.is_empty() {
                            if let (Ok(name), Ok(val)) = (
                                hudsucker::hyper::header::HeaderName::from_bytes(h.key.as_bytes()),
                                HeaderValue::from_str(&h.value),
                            ) {
                                // Only add if breakpoint didn't already set this header
                                if !parts.headers.contains_key(&name) || matched_bp.is_none() {
                                    parts.headers.insert(name, val);
                                }
                            }
                        }
                    }
                    if mapping.headers_add.iter().any(|h| h.enabled && !h.key.is_empty()) {
                        overrides.push("headers_add".to_string());
                    }

                    // Remove headers
                    for h in &mapping.headers_remove {
                        if !h.key.is_empty() {
                            if let Ok(name) = hudsucker::hyper::header::HeaderName::from_bytes(h.key.as_bytes()) {
                                parts.headers.remove(&name);
                            }
                        }
                    }
                    if mapping.headers_remove.iter().any(|h| !h.key.is_empty()) {
                        overrides.push("headers_remove".to_string());
                    }

                    // Set cookies via Set-Cookie headers
                    for cookie in &mapping.cookies {
                        let mut cookie_parts = vec![format!("{}={}", cookie.name, cookie.value)];
                        if !cookie.domain.is_empty() { cookie_parts.push(format!("Domain={}", cookie.domain)); }
                        if !cookie.path.is_empty() { cookie_parts.push(format!("Path={}", cookie.path)); }
                        if cookie.secure { cookie_parts.push("Secure".to_string()); }
                        if cookie.http_only { cookie_parts.push("HttpOnly".to_string()); }
                        if !cookie.same_site.is_empty() { cookie_parts.push(format!("SameSite={}", cookie.same_site)); }
                        if !cookie.expires.is_empty() { cookie_parts.push(format!("Expires={}", cookie.expires)); }
                        let cookie_str = cookie_parts.join("; ");
                        if let Ok(val) = HeaderValue::from_str(&cookie_str) {
                            parts.headers.append(hudsucker::hyper::header::SET_COOKIE, val);
                        }
                    }
                    if !mapping.cookies.is_empty() {
                        overrides.push("cookies".to_string());
                    }

                    // Replace response body (only if breakpoint didn't already replace)
                    if mapping.response_body_enabled && !bp_replaced_body {
                        let (body_bytes, ct) = read_mapping_response_body(mapping).await;
                        final_bytes = Bytes::from(body_bytes);
                        final_content_type = Some(ct.clone());
                        if let Ok(val) = HeaderValue::from_str(&ct) {
                            parts.headers.insert(CONTENT_TYPE, val);
                        }
                        if let Ok(val) = HeaderValue::from_str(&final_bytes.len().to_string()) {
                            parts.headers.insert(CONTENT_LENGTH, val);
                        }
                        overrides.push("response_body".to_string());
                    }

                    if !overrides.is_empty() {
                        log::info!(
                            "Mapping applied: '{}' matched '{}' — overrides: {:?}",
                            url, mapping.url_pattern, overrides,
                        );
                        let timestamp = std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as i64;
                        mapping_emit_fn(&MappingAppliedEvent {
                            mapping_id: mapping.id.clone(),
                            mapping_name: mapping.id.clone(),
                            request_id,
                            timestamp,
                            overrides_applied: overrides,
                            original_url: None,
                            remapped_url: None,
                        });
                    }
                }
            }

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

            }

            res
        }
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn handler_creates_with_no_pending() {
        let paused_emit_fn: PausedEmitFn = Arc::new(|_| {});
        let request_emit_fn: RequestEmitFn = Arc::new(|_| {});
        let response_emit_fn: ResponseEmitFn = Arc::new(|_| {});
        let mapping_emit_fn: MappingEmitFn = Arc::new(|_| {});
        let breakpoints: BreakpointsRef = Arc::new(Mutex::new(Vec::new()));
        let mappings: MappingsRef = Arc::new(Mutex::new(Vec::new()));
        let pause_registry: PauseRegistryRef = Arc::new(Mutex::new(HashMap::new()));
        let pause_timeout: PauseTimeoutRef = Arc::new(Mutex::new(30));
        let handler = InterceptHandler::new(paused_emit_fn, request_emit_fn, response_emit_fn, mapping_emit_fn, breakpoints, mappings, pause_registry, pause_timeout);
        assert!(handler.pending.is_none());
    }
}
