pub mod types;
pub mod url_matching;
pub mod handler;
pub mod server;

// Re-export all public items so external callers (lib.rs) remain unchanged.
pub use types::*;
pub use url_matching::{match_url, UrlMatchResult};
pub use server::ProxyServer;
