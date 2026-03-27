/// Disable the system-level proxy on all active network services.
/// Safe to call from any context (exit handler, command, etc.).
pub fn disable_os_proxy_all_services() {
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = std::process::Command::new("networksetup")
            .args(["-listallnetworkservices"])
            .current_dir("/tmp")
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            for service in text
                .lines()
                .skip(1)
                .filter(|s| !s.starts_with('*') && !s.trim().is_empty())
            {
                let _ = std::process::Command::new("networksetup")
                    .args(["-setwebproxystate", service, "off"])
                    .current_dir("/tmp")
                    .output();
                let _ = std::process::Command::new("networksetup")
                    .args(["-setsecurewebproxystate", service, "off"])
                    .current_dir("/tmp")
                    .output();
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "0",
                "/f",
            ])
            .output();
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
