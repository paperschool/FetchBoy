use serde::Deserialize;
use std::sync::{Arc, Mutex};

use super::match_type::MatchType;
use crate::proxy::url_matching::match_url;

/// A proxy ignore rule. A request whose URL matches an enabled rule is forwarded
/// untouched: not captured, not paused by breakpoints, not rewritten by mappings.
#[derive(Deserialize, Clone)]
pub struct IgnoreRule {
    pub id: String,
    pub url_pattern: String,
    pub match_type: MatchType,
    pub enabled: bool,
}

pub type IgnoreRulesRef = Arc<Mutex<Vec<IgnoreRule>>>;

/// True if any enabled ignore rule matches the URL — i.e. the proxy should bypass it.
pub fn should_bypass(rules: &[IgnoreRule], url: &str) -> bool {
    rules.iter().any(|r| {
        r.enabled && match_url(url, &r.url_pattern, r.match_type.as_str()).matches
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rule(pattern: &str, match_type: MatchType, enabled: bool) -> IgnoreRule {
        IgnoreRule {
            id: "r1".to_string(),
            url_pattern: pattern.to_string(),
            match_type,
            enabled,
        }
    }

    #[test]
    fn enabled_matching_rule_bypasses() {
        let rules = vec![rule("api.example.com", MatchType::Partial, true)];
        assert!(should_bypass(&rules, "https://api.example.com/users"));
    }

    #[test]
    fn disabled_rule_does_not_bypass() {
        let rules = vec![rule("api.example.com", MatchType::Partial, false)];
        assert!(!should_bypass(&rules, "https://api.example.com/users"));
    }

    #[test]
    fn non_matching_rule_does_not_bypass() {
        let rules = vec![rule("other.example.com", MatchType::Partial, true)];
        assert!(!should_bypass(&rules, "https://api.example.com/users"));
    }

    #[test]
    fn empty_rules_do_not_bypass() {
        assert!(!should_bypass(&[], "https://api.example.com/users"));
    }

    #[test]
    fn wildcard_rule_bypasses() {
        let rules = vec![rule("https://*.example.com/*", MatchType::Wildcard, true)];
        assert!(should_bypass(&rules, "https://api.example.com/users"));
    }
}
