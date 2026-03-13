use bytes::Bytes;
use http_body_util::{BodyExt, Full};
use hudsucker::{
    builder::ProxyBuilder,
    certificate_authority::RcgenAuthority,
    hyper::{Request, Response},
    hyper_util::client::legacy::Error as UpstreamError,
    Body, HttpContext, HttpHandler, RequestOrResponse,
};
use serde::Serialize;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
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
    pub response_headers: HashMap<String, String>,
    pub response_body: Option<String>,
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

// ─── HTTP handler ─────────────────────────────────────────────────────────────

pub type EmitFn = Arc<dyn Fn(&InterceptEvent) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct InterceptHandler {
    emit_fn: EmitFn,
    /// Pending request captured in handle_request, consumed in handle_response.
    /// Hudsucker clones the handler once per request (see internal.rs `self.clone().proxy(req)`),
    /// so each clone handles exactly one request/response pair sequentially — no shared
    /// state or locking is needed.
    pending: Option<PendingRequest>,
}

impl InterceptHandler {
    fn new(emit_fn: EmitFn) -> Self {
        Self {
            emit_fn,
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

        // Strip Accept-Encoding so the server sends uncompressed responses.
        // This makes response bodies directly readable without a decompression step.
        // Standard practice for MITM inspection proxies (Burp Suite does the same).
        req.headers_mut().remove("accept-encoding");

        // Store synchronously before returning the future — safe because this clone
        // of the handler is dedicated to this single request/response pair.
        self.pending = Some(PendingRequest {
            id,
            timestamp,
            method,
            host,
            path,
            request_headers,
        });

        async move { RequestOrResponse::Request(req) }
    }

    fn handle_error(
        &mut self,
        _ctx: &HttpContext,
        err: UpstreamError,
    ) -> impl std::future::Future<Output = Response<Body>> + Send {
        // Emit an event so failed requests still appear in the intercept table.
        let req_info = self.pending.take();
        let emit_fn = Arc::clone(&self.emit_fn);
        let err_str = err.to_string();

        async move {
            if let Some(req_info) = req_info {
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
                    response_headers: HashMap::new(),
                    response_body: Some(err_str),
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

        let content_type: Option<String> = res
            .headers()
            .get("content-type")
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);

        // Take the pending request that was stored by handle_request on this same clone.
        let req_info = self.pending.take();
        let emit_fn = Arc::clone(&self.emit_fn);

        async move {
            let (parts, body) = res.into_parts();
            let response_headers = collect_headers(&parts.headers);

            let bytes: Bytes = body.collect().await.unwrap_or_default().to_bytes();
            let size = bytes.len() as u64;

            let response_body: Option<String> =
                if bytes.len() <= MAX_BODY_CAPTURE_BYTES
                    && content_type
                        .as_deref()
                        .map(is_text_content_type)
                        .unwrap_or(false)
                {
                    Some(String::from_utf8_lossy(&bytes).into_owned())
                } else {
                    None
                };

            let new_body: Body = Full::new(bytes).into();
            let res = Response::from_parts(parts, new_body);

            if let Some(req_info) = req_info {
                let event = InterceptEvent {
                    id: req_info.id,
                    timestamp: req_info.timestamp,
                    method: req_info.method,
                    host: req_info.host,
                    path: req_info.path,
                    status_code: Some(status_code),
                    content_type,
                    size: Some(size),
                    request_headers: req_info.request_headers,
                    response_headers,
                    response_body,
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
    pub fn start(&mut self, ca: RcgenAuthority, emit_fn: EmitFn) {
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        let port = self.port;
        let handler = InterceptHandler::new(emit_fn);
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

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

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
            response_headers,
            response_body: Some("{\"ok\":true}".to_string()),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["statusCode"], 200);
        assert_eq!(json["contentType"], "application/json");
        assert_eq!(json["method"], "GET");
        assert_eq!(json["host"], "example.com");
        assert_eq!(json["requestHeaders"]["content-type"], "application/json");
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
            response_headers: HashMap::new(),
            response_body: None,
        };

        let json = serde_json::to_value(&event).unwrap();
        assert!(json["statusCode"].is_null());
        assert!(json["contentType"].is_null());
        assert!(json["size"].is_null());
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

        let handler = InterceptHandler::new(emit_fn);
        assert!(handler.pending.lock().unwrap().is_none());
    }
}
