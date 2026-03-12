# Story 9.3: MITM Proxy Backend

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Fetch Boy user,
I want a local MITM proxy that captures HTTP/HTTPS traffic automatically,
so that I can monitor network requests in real-time without manual configuration.

## Acceptance Criteria

1. `hudsucker` (v0.24.0) added to `src-tauri/Cargo.toml`
2. A self-signed CA certificate is generated on first launch and stored in the app data directory
3. The CA certificate is added to the OS trust store on first launch (macOS: `security`, Windows: `certutil`)
4. A local proxy listener starts on app launch (configurable port, default `8080`) and stops on app exit
5. Proxy intercepts both HTTP and HTTPS traffic
6. Intercepted request metadata (timestamp, method, host, path, status code, content-type, size) is extracted
7. No request pausing, modification, or forwarding controls — capture and pass-through only
8. Proxy errors are logged but do not crash the app

## Tasks / Subtasks

- [ ] Task 1 — Add hudsucker to Cargo.toml (AC: #1)
  - [ ] Add `hudsucker = "0.24.0"` to `src-tauri/Cargo.toml`
  - [ ] Use `rcgen-ca` feature for certificate generation: `hudsucker = { version = "0.24.0", features = ["rcgen-ca"] }`
  - [ ] Run `cargo check` to verify dependencies compile
- [ ] Task 2 — Create certificate authority module (AC: #2, #3)
  - [ ] Create `src-tauri/src/cert.rs`
  - [ ] Implement `CertificateAuthority` struct with:
    - `generate_ca()`: Create self-signed CA on first launch
    - `load_or_create()`: Check if CA exists in app data, create if not
    - `install_to_system()`: Add CA to OS trust store (macOS/Windows)
  - [ ] Store CA in app data directory: `{app_data_dir}/ca/`
  - [ ] CA files: `ca.pem` (public), `ca-key.pem` (private)
- [ ] Task 3 — Create MITM proxy module (AC: #4, #5, #6, #7, #8)
  - [ ] Create `src-tauri/src/proxy.rs`
  - [ ] Implement `ProxyServer` struct with:
    - `new(port: u16)`: Create proxy on specified port
    - `start()`: Start the proxy listener
    - `stop()`: Stop the proxy listener
    - `run()`: Block until shutdown signal
  - [ ] Use hudsucker `ProxyBuilder` with:
    - `RcgenAuthority` for CA
    - Request/response handler that logs but passes through
    - Extract metadata: timestamp, method, host, path, status code, content-type, size
  - [ ] Handle errors gracefully - log but don't crash
- [ ] Task 4 — Integrate proxy with Tauri app (AC: #4, #8)
  - [ ] Modify `src-tauri/src/lib.rs`:
    - Add proxy server as app state
    - Start proxy on `Builder::setup()`
    - Stop proxy on app exit
  - [ ] Add proxy configuration to app settings (port, enabled/disabled)
- [ ] Task 5 — Emit Tauri events for intercepted requests (AC: #6, Story 9.4 prerequisite)
  - [ ] Create Tauri event `intercept:request`
  - [ ] Payload matches frontend `InterceptRequest` type:
    ```json
    {
      "id": "uuid",
      "timestamp": 1234567890,
      "method": "GET",
      "host": "example.com",
      "path": "/api/data",
      "statusCode": 200,
      "contentType": "application/json",
      "size": 1234
    }
    ```
  - [ ] Emit event from proxy handler for each request
- [ ] Task 6 — Add proxy toggle to frontend (AC: #4 - configurable)
  - [ ] Add proxy settings to existing settings panel or create proxy toggle
  - [ ] Allow user to enable/disable proxy
  - [ ] Allow user to change proxy port
- [ ] Task 7 — Test proxy functionality (AC: #5, #6, #7)
  - [ ] Test HTTP interception
  - [ ] Test HTTPS interception
  - [ ] Verify CA is generated and installed
  - [ ] Verify events are emitted to frontend
- [ ] Final Task — Commit story changes
  - [ ] Commit all code and documentation changes for this story with a message that includes Story 9.3

## Dev Notes

### hudsucker Crate Reference

**Latest Version:** 0.24.0

**Cargo.toml:**
```toml
hudsucker = { version = "0.24.0", features = ["rcgen-ca"] }
```

**Features:**
- `rcgen-ca`: Use `rcgen` for certificate generation (recommended)
- `openssl-ca`: Use OpenSSL for certificate generation
- `native-tls-client`: Native TLS for client connections
- `rustls-client`: Rustls for client connections
- `http2`: HTTP/2 support

### Certificate Authority Implementation

```rust
// src-tauri/src/cert.rs
use std::path::PathBuf;
use hudsucker::certificate_authority::RcgenAuthority;
use rcgen::{CertificateParams, DistinguishedName, DnType};
use std::fs;

pub struct CertificateAuthority {
    ca: RcgenAuthority,
    cert_path: PathBuf,
    key_path: PathBuf,
}

impl CertificateAuthority {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        let ca_dir = app_data_dir.join("ca");
        fs::create_dir_all(&ca_dir)?;
        
        let cert_path = ca_dir.join("ca.pem");
        let key_path = ca_dir.join("ca-key.pem");
        
        let ca = if cert_path.exists() && key_path.exists() {
            // Load existing CA
            let cert = fs::read_to_string(&cert_path)?;
            let key = fs::read_to_string(&key_path)?;
            RcgenAuthority::from_pem(&cert, &key)?
        } else {
            // Generate new CA
            let mut distinguished_name = DistinguishedName::new();
            distinguished_name.push(DnType::CommonName, "FetchBoy Proxy CA");
            
            let params = CertificateParams::default()
                .distinguished_name(distinguished_name)
                .is_ca(true);
            
            let ca = RcgenAuthority::new(params)?;
            
            // Save CA to disk
            fs::write(&cert_path, ca.certificate_pem())?;
            fs::write(&key_path, ca.private_key_pem())?;
            
            ca
        };
        
        Ok(Self { ca, cert_path, key_path })
    }
    
    pub fn install_to_system(&self) -> Result<(), Box<dyn std::error::Error>> {
        #[cfg(target_os = "macos")]
        {
            // Use security command to add CA to macOS trust store
            let output = std::process::Command::new("security")
                .args(["add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", self.cert_path.to_str().unwrap()])
                .output()?;
            // Note: This requires user permission
        }
        
        #[cfg(target_os = "windows")]
        {
            let output = std::process::Command::new("certutil")
                .args(["-addstore", "Root", self.cert_path.to_str().unwrap()])
                .output()?;
        }
        
        Ok(())
    }
    
    pub fn authority(&self) -> &RcgenAuthority {
        &self.ca
    }
}
```

### Proxy Server Implementation

```rust
// src-tauri/src/proxy.rs
use hudsucker::{
    hyper::service::service_fn,
    hyper::{Body, Request, Response},
    ProxyBuilder, RcgenAuthority,
};
use serde::Serialize;
use std::sync::Arc;
use std::net::SocketAddr;
use tokio::sync::broadcast;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct InterceptEvent {
    pub id: String,
    pub timestamp: i64,
    pub method: String,
    pub host: String,
    pub path: String,
    pub status_code: Option<u16>,
    pub content_type: Option<String>,
    pub size: Option<u64>,
}

pub struct ProxyServer {
    port: u16,
    shutdown_tx: broadcast::Sender<()>,
}

impl ProxyServer {
    pub fn new(port: u16) -> Self {
        let (shutdown_tx, _) = broadcast::channel(1);
        Self { port, shutdown_tx }
    }
    
    pub async fn start(
        &self,
        ca: RcgenAuthority,
        app_handle: AppHandle,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let app_handle = Arc::new(app_handle);
        let shutdown_rx = self.shutdown_tx.subscribe();
        
        let proxy = ProxyBuilder::new()
            .with_authority(ca)
            .with_request_handler(service_fn(move |req: Request<Body>| {
                let app = app_handle.clone();
                async move {
                    let event = extract_request_event(req);
                    let _ = app.emit("intercept:request", event);
                    Ok::<_, hyper::Error>(Response::new(Body::empty()))
                }
            }))
            .with_response_handler(service_fn(|res: Response<Body>| {
                // Extract response metadata here if needed
                Ok::<_, hyper::Error>(res)
            }))
            .build();
        
        let addr: SocketAddr = ([127, 0, 0, 1], self.port).into();
        
        tokio::select! {
            result = proxy.listen(addr) => {
                if let Err(e) = result {
                    log::error!("Proxy error: {}", e);
                }
            }
            _ = shutdown_rx.recv() => {
                log::info!("Proxy shutdown signal received");
            }
        }
        
        Ok(())
    }
    
    pub fn stop(&self) {
        let _ = self.shutdown_tx.send(());
    }
}

fn extract_request_event(req: Request<Body>) -> InterceptEvent {
    let method = req.method().to_string();
    let uri = req.uri();
    let host = uri.host().unwrap_or("unknown").to_string();
    let path = uri.path_and_query()
        .map(|pq| pq.to_string())
        .unwrap_or_else(|| "/".to_string());
    
    InterceptEvent {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as i64,
        method,
        host,
        path,
        status_code: None, // Will be set by response handler
        content_type: None,
        size: None,
    }
}
```

### Integration with Tauri App

```rust
// src-tauri/src/lib.rs
mod cert;
mod proxy;

use std::sync::Arc;
use tauri::Manager;

pub struct AppState {
    pub proxy_server: Option<proxy::ProxyServer>,
    pub ca: Option<cert::CertificateAuthority>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            // Initialize CA
            let ca = cert::CertificateAuthority::new(app_data_dir.clone())
                .expect("Failed to initialize certificate authority");
            
            // Try to install CA to system (may require user permission)
            if let Err(e) = ca.install_to_system() {
                log::warn!("Failed to install CA to system: {}", e);
            }
            
            // Start proxy
            let proxy = proxy::ProxyServer::new(8080);
            let app_handle = app.handle().clone();
            let ca_clone = ca.authority().clone();
            
            tauri::async_runtime::spawn(async move {
                if let Err(e) = proxy.start(ca_clone, app_handle).await {
                    log::error!("Failed to start proxy: {}", e);
                }
            });
            
            app.manage(AppState {
                proxy_server: Some(proxy),
                ca: Some(ca),
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Frontend InterceptRequest Type (from Story 9.2)

```typescript
// src/stores/interceptStore.ts
export interface InterceptRequest {
  id: string
  timestamp: number
  method: string
  host: string
  path: string
  statusCode?: number
  contentType?: string
  size?: number
}
```

The backend must emit events that match this interface.

### macOS CA Installation Note

On macOS, adding a certificate to the system trust store requires:
1. User permission (GUI prompt)
2. The certificate must be in DER format for `security add-trusted-cert`

Consider using a helper script or documenting manual steps for users.

### Error Handling

- **CA Generation Failure:** Log error, exit gracefully
- **CA Installation Failure:** Log warning, continue (proxy still works, just HTTPS won't work without user manually trusting)
- **Proxy Start Failure:** Log error, disable proxy feature for this session
- **Proxy Runtime Error:** Log error, attempt restart, don't crash app

### New Files to Create

| File | Purpose | Size Limit |
|------|---------|-----------|
| `src-tauri/src/cert.rs` | Certificate authority management | ~100 lines |
| `src-tauri/src/proxy.rs` | MITM proxy server | ~150 lines |
| Tests for cert.rs | CA generation tests | - |
| Tests for proxy.rs | Proxy functionality tests | - |

### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `src-tauri/Cargo.toml` | Add hudsucker dependency | Low - additive |
| `src-tauri/src/lib.rs` | Initialize and manage proxy | Medium - setup changes |

### Dependencies Added

```toml
# src-tauri/Cargo.toml - add these
hudsucker = { version = "0.24.0", features = ["rcgen-ca"] }
uuid = { version = "1", features = ["v4"] }
rcgen = "0.13" # Included via hudsucker feature
```

### Project Structure Notes

- Certificate storage: `{app_data}/ca/` directory
- CA files: `ca.pem`, `ca-key.pem`
- Proxy runs on configurable port (default 8080)
- No changes to frontend React components for this story (Story 9.4 handles event connection)
- This story creates the backend infrastructure; Story 9.4 connects it to the frontend

### Testing Standards

- Test CA generation (first run vs. existing CA)
- Test proxy start/stop
- Test HTTP interception
- Test HTTPS interception (with generated CA)
- Test error handling (port in use, etc.)
- Test Tauri event emission

### Manual Testing Note

To test the proxy:
1. Start the app with this story's code
2. Configure system to use localhost:8080 as proxy
3. Make HTTP/HTTPS requests
4. Check Intercept tab in app (Story 9.2 UI must be working, or check logs)
5. Verify CA was generated in app data directory

### Dependencies with Previous Stories

- **Story 9.1:** Creates the tab shell and Intercept view placeholder
- **Story 9.2:** Creates the frontend store and table UI that displays intercepted requests
- **Story 9.4:** Connects this backend to the frontend via Tauri events

This story (9.3) is the backend foundation that makes Stories 9.2 and 9.4 functional.

### Context from Epic 9

Epic 9 is about creating a minimal viable TLS proxy intercept feature. This story is the core backend that:
- Generates and manages the CA certificate
- Spins up the MITM proxy
- Extracts and forwards request metadata

The scope is intentionally limited to capture-only (no modification, pausing, or forwarding controls).

### References

- hudsucker crate: https://crates.io/crates/hudsucker
- hudsucker docs: https://docs.rs/hudsucker
- macOS certificate trust: https://support.apple.com/guide/keychain-access/add-certificates-to-a-keychain-keychain-access-help
- Windows certificate store: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil
- Story 9.2 (previous): `_bmad-output/implementation-artifacts/9-2-intercept-table-view-ui.md`
- Story 9.1 (parent): `_bmad-output/implementation-artifacts/9-1-top-level-tab-shell.md`
- Epic 9 overview: `_bmad-output/planning-artifacts/epic-9.md`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List

