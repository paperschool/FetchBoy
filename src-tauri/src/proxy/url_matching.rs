use regex::Regex;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

// ─── Regex Cache ──────────────────────────────────────────────────────────────

/// Module-private cache for compiled regex patterns.
/// Avoids recompiling the same pattern on every URL match check.
static REGEX_CACHE: LazyLock<Mutex<HashMap<String, Regex>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

// ─── URL Matching ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct UrlMatchResult {
    pub matches: bool,
    pub matched_pattern: String,
}

/// Match a URL against a pattern using the specified match type.
/// Returns a UrlMatchResult indicating whether the URL matches.
pub fn match_url(url: &str, pattern: &str, match_type: &str) -> UrlMatchResult {
    let matches = match match_type {
        "exact" => url == pattern,
        "partial" => url.contains(pattern),
        "wildcard" => match_wildcard(url, pattern),
        "regex" => match_regex(url, pattern).unwrap_or(false),
        _ => false,
    };
    UrlMatchResult {
        matches,
        matched_pattern: pattern.to_string(),
    }
}

fn match_wildcard(url: &str, pattern: &str) -> bool {
    // Convert glob-style wildcards to a regex pattern.
    // Escape dots and convert * to .*
    let regex_pattern = format!("^{}$", pattern.replace('.', "\\.").replace('*', ".*"));
    let mut cache = REGEX_CACHE.lock().unwrap();
    let re = cache
        .entry(regex_pattern.clone())
        .or_insert_with(|| match Regex::new(&regex_pattern) {
            Ok(re) => re,
            Err(_) => Regex::new("^$").unwrap(),
        });
    re.is_match(url)
}

fn match_regex(url: &str, pattern: &str) -> Result<bool, regex::Error> {
    let mut cache = REGEX_CACHE.lock().unwrap();
    if let Some(re) = cache.get(pattern) {
        return Ok(re.is_match(url));
    }
    let re = Regex::new(pattern)?;
    let result = re.is_match(url);
    cache.insert(pattern.to_string(), re);
    Ok(result)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn match_url_exact_matches_identical_urls() {
        let result = match_url("https://api.example.com/users/123", "https://api.example.com/users/123", "exact");
        assert!(result.matches);
    }

    #[test]
    fn match_url_exact_does_not_match_different_url() {
        let result = match_url("https://api.example.com/users/123", "https://api.example.com/users", "exact");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_partial_matches_substring() {
        let result = match_url("https://example.com/api/users/123", "api/users", "partial");
        assert!(result.matches);
    }

    #[test]
    fn match_url_partial_does_not_match_absent_substring() {
        let result = match_url("https://example.com/api/orders/456", "api/users", "partial");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_wildcard_matches_glob_pattern() {
        let result = match_url("/foo/api/users/123", "*/api/users/*", "wildcard");
        assert!(result.matches);
    }

    #[test]
    fn match_url_wildcard_does_not_match_mismatched_pattern() {
        let result = match_url("/foo/api/orders/123", "*/api/users/*", "wildcard");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_regex_matches_valid_pattern() {
        let result = match_url("/api/users/123", r"^/api/users/\d+$", "regex");
        assert!(result.matches);
    }

    #[test]
    fn match_url_regex_does_not_match_non_digit_id() {
        let result = match_url("/api/users/abc", r"^/api/users/\d+$", "regex");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_regex_returns_false_for_invalid_pattern() {
        let result = match_url("/api/users/123", "[invalid", "regex");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_unknown_type_returns_false() {
        let result = match_url("/api/users/123", "/api/users", "unknown");
        assert!(!result.matches);
    }

    #[test]
    fn match_url_result_contains_matched_pattern() {
        let result = match_url("https://api.example.com/users", "api/users", "partial");
        assert_eq!(result.matched_pattern, "api/users");
    }

    #[test]
    fn regex_cache_reuses_compiled_patterns() {
        // First call compiles the pattern
        let r1 = match_url("/api/users/123", r"^/api/users/\d+$", "regex");
        assert!(r1.matches);
        // Second call should use cache
        let r2 = match_url("/api/users/456", r"^/api/users/\d+$", "regex");
        assert!(r2.matches);
    }

    #[test]
    fn wildcard_cache_reuses_compiled_patterns() {
        let r1 = match_url("/foo/bar", "*/bar", "wildcard");
        assert!(r1.matches);
        let r2 = match_url("/baz/bar", "*/bar", "wildcard");
        assert!(r2.matches);
    }
}
