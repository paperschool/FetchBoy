use serde::Deserialize;
use std::sync::{Arc, Mutex};

use super::match_type::MatchType;

#[derive(Deserialize, Clone)]
pub struct BreakpointHeader {
    pub key: String,
    pub value: String,
    pub enabled: bool,
}

#[derive(Deserialize, Clone)]
pub struct BreakpointRule {
    pub id: String,
    pub name: String,
    pub url_pattern: String,
    pub match_type: MatchType,
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
