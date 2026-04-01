use hudsucker::{
    builder::ProxyBuilder,
    certificate_authority::RcgenAuthority,
};
use std::net::{SocketAddr, TcpListener};
use tokio::sync::oneshot;

use super::handler::InterceptHandler;
use super::types::*;

/// Check whether a port is available for binding on localhost.
pub fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
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
        paused_emit_fn: PausedEmitFn,
        request_emit_fn: RequestEmitFn,
        response_emit_fn: ResponseEmitFn,
        mapping_emit_fn: MappingEmitFn,
        chain_emit_fn: ChainEmitFn,
        breakpoints: BreakpointsRef,
        mappings: MappingsRef,
        pause_registry: PauseRegistryRef,
        pause_timeout: PauseTimeoutRef,
        chain_registry: ChainRegistryRef,
        chain_timeout: ChainTimeoutRef,
    ) {
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);

        let port = self.port;
        let handler = InterceptHandler::new(paused_emit_fn, request_emit_fn, response_emit_fn, mapping_emit_fn, chain_emit_fn, breakpoints, mappings, pause_registry, pause_timeout, chain_registry, chain_timeout);
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
    fn is_port_available_returns_true_for_unused_port() {
        // Use port 0 to get an OS-assigned free port, then check a nearby high port
        assert!(is_port_available(49152)); // Ephemeral range, likely free
    }

    #[test]
    fn is_port_available_returns_false_for_bound_port() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(!is_port_available(port));
        drop(listener);
        assert!(is_port_available(port));
    }
}
