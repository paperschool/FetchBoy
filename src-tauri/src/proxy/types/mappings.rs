use serde::Deserialize;
use std::sync::{Arc, Mutex};

use super::match_type::MatchType;

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
    pub match_type: MatchType,
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
    #[serde(default)]
    pub use_chain: bool,
    pub chain_id: Option<String>,
}

pub type MappingsRef = Arc<Mutex<Vec<MappingRule>>>;

/// Read a mapping's response body as raw bytes, preferring file path over inline body.
/// Falls back to inline body if file read fails, logging a warning.
pub async fn read_mapping_response_body(rule: &MappingRule) -> (Vec<u8>, String) {
    let ct = rule.response_body_content_type.clone();
    if !rule.response_body_file_path.is_empty() {
        match tokio::fs::read(&rule.response_body_file_path).await {
            Ok(content) => return (content, ct),
            Err(e) => {
                log::warn!(
                    "Mapping '{}': failed to read file '{}': {} — falling back to inline body",
                    rule.id, rule.response_body_file_path, e,
                );
            }
        }
    }
    (rule.response_body.clone().into_bytes(), ct)
}
