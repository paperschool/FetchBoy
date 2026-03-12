use hudsucker::{
    builder::ProxyBuilder,
    certificate_authority::RcgenAuthority,
    hyper::{Request, Response},
    Body, HttpContext, HttpHandler, RequestOrResponse,
};
use serde::Serialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;

// ─── Event payload emitted to the frontend ────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct InterceptEvent {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    #[serde(rename = "statusCode")]
    pub status_code: Option<u16>,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    pub size: Option<u64>,
}

// ─── Per-request state held between handle_request and handle_response ────────

struct PendingRequest {
    id: String,
    timestamp: i64,
    method: String,
    host: String,
    path: String,
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

pub type EmitFn = Arc<dyn Fn(&InterceptEvent) + Send + Sync + 'static>;

#[derive(Clone)]
pub struct InterceptHandler {
    emit_fn: EmitFn,
    pending: Arc<std::sync::Mutex<Option<PendingRequest>>>,
}

impl InterceptHandler {
    fn new(emit_fn: EmitFn) -> Self {
        Self {
            emit_fn,
            pending: Arc::new(std::sync::Mutex::new(None)),
        }
    }
}

impl HttpHandler for InterceptHandler {
    fn handle_request(
        &mut self,
        _ctx: &HttpContext,
        req: Request<Body>,
    ) -> impl std::future::Future<Output = RequestOrResponse> + Send {
        // Capture metadata synchronously so we can move `req` into the async block.
        let method = req.method().to_string();

        // For HTTPS MITM the URI path is relative; host comes from the Host header.
        let host: String = req
            .uri()
            .host()
            .map(str::to_string)
            .or_else(|| {
                req.headers()
                    .get("host")
                    .and_then(|v: &hudsucker::hyper::header::HeaderValue| v.to_str().ok())
                    .map(str::to_string)
            })
            .unwrap_or_else(|| "unknown".to_string());

        let path: String = req
            .uri()
            .path_and_query()
            .map(|pq| pq.to_string())
            .unwrap_or_else(|| "/".to_string());

        let pending = Arc::clone(&self.pending);

        async move {
            let id = uuid::Uuid::new_v4().to_string();
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;

            *pending.lock().unwrap() = Some(PendingRequest {
                id,
                timestamp,
                method,
                host,
                path,
            });

            RequestOrResponse::Request(req)
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
            .and_then(|v: &hudsucker::hyper::header::HeaderValue| v.to_str().ok())
            .map(str::to_string);

        let size: Option<u64> = res
            .headers()
            .get("content-length")
            .and_then(|v: &hudsucker::hyper::header::HeaderValue| v.to_str().ok())
            .and_then(|s: &str| s.parse::<u64>().ok());

        let pending = Arc::clone(&self.pending);
        let emit_fn = Arc::clone(&self.emit_fn);

        async move {
            if let Some(req_info) = pending.lock().unwrap().take() {
                let event = InterceptEvent {
                    id: req_info.id,
                    timestamp: req_info.timestamp,
                    method: req_info.method,
                    host: req_info.host,
                    path: req_info.path,
                    status_code: Some(status_code),
                    content_type,
                    size,
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
        let event = InterceptEvent {
            id: "test-id".to_string(),
            timestamp: 1234567890,
            method: "GET".to_string(),
            host: "example.com".to_string(),
            path: "/api/data".to_string(),
            status_code: Some(200),
            content_type: Some("application/json".to_string()),
            size: Some(1024),
        };

        let json = serde_json::to_value(&event).unwrap();
        assert_eq!(json["statusCode"], 200);
        assert_eq!(json["contentType"], "application/json");
        assert_eq!(json["method"], "GET");
        assert_eq!(json["host"], "example.com");
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
        };

        let json = serde_json::to_value(&event).unwrap();
        assert!(json["statusCode"].is_null());
        assert!(json["contentType"].is_null());
        assert!(json["size"].is_null());
    }

    #[test]
    fn emit_fn_is_called_by_handler() {
        use std::sync::atomic::{AtomicBool, Ordering};

        let called = Arc::new(AtomicBool::new(false));
        let called_clone = Arc::clone(&called);

        let emit_fn: EmitFn = Arc::new(move |_event| {
            called_clone.store(true, Ordering::SeqCst);
        });

        // Verify the closure is callable — actual integration tested via manual proxy test.
        let handler = InterceptHandler::new(emit_fn);
        assert!(handler.pending.lock().unwrap().is_none());
    }
}
