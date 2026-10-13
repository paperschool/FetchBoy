/// Disable the system-level proxy on all active network services.
/// Safe to call from any context (exit handler, command, etc.).
///
/// Returns an error listing every service/command that failed instead of
/// silently swallowing failures — a partial failure here previously left the
/// OS proxy pointing at a dead listener with no way to diagnose why.
pub fn disable_os_proxy_all_services() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let out = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to list network services: {e}"))?;

        let text = String::from_utf8_lossy(&out.stdout);
        let mut failures: Vec<String> = Vec::new();

        for service in text
            .lines()
            .skip(1)
            .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
        {
            for (flag, label) in [
                ("-setwebproxystate", "web proxy"),
                ("-setsecurewebproxystate", "secure web proxy"),
            ] {
                match std::process::Command::new("networksetup")
                    .args([flag, service, "off"])
                    .current_dir("/tmp")
                    .output()
                {
                    Ok(result) if !result.status.success() => failures.push(format!(
                        "{service} ({label}): {}",
                        String::from_utf8_lossy(&result.stderr).trim()
                    )),
                    Err(e) => failures.push(format!("{service} ({label}): {e}")),
                    Ok(_) => {}
                }
            }
        }

        if failures.is_empty() {
            Ok(())
        } else {
            Err(format!(
                "Failed to disable OS proxy for: {}",
                failures.join("; ")
            ))
        }
    }
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "0",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to disable proxy: {e}"))?;
        if out.status.success() {
            Ok(())
        } else {
            Err(format!(
                "reg add ProxyEnable failed: {}",
                String::from_utf8_lossy(&out.stderr)
            ))
        }
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(())
    }
}

/// List active (non-disabled) network services on macOS.
/// Returns an empty Vec on non-macOS platforms.
#[cfg(target_os = "macos")]
pub fn list_network_services() -> Vec<String> {
    let Ok(out) = std::process::Command::new("networksetup")
        .args(["-listallnetworkservices"])
        .output()
    else {
        return Vec::new();
    };
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines()
        .skip(1)
        .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect()
}
