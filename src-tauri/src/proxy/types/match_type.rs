use serde::{Deserialize, Serialize};

/// URL match strategy used by breakpoints and mappings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchType {
    Exact,
    Partial,
    Wildcard,
    Regex,
}

impl MatchType {
    /// Convert to the string representation used in URL matching.
    pub fn as_str(&self) -> &'static str {
        match self {
            MatchType::Exact => "exact",
            MatchType::Partial => "partial",
            MatchType::Wildcard => "wildcard",
            MatchType::Regex => "regex",
        }
    }
}
