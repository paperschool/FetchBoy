use tauri::Manager;

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| format!("Failed to open folder: {}", e))
}

#[tauri::command]
pub fn configure_system_proxy(port: u16) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let services = crate::platform::list_network_services();
        let port_str = port.to_string();
        let mut last_err: Option<String> = None;

        for service in &services {
            let http = std::process::Command::new("networksetup")
                .args(["-setwebproxy", service, "127.0.0.1", &port_str])
                .output()
                .map_err(|e| format!("Failed to set HTTP proxy for {service}: {e}"))?;
            if !http.status.success() {
                last_err = Some(format!(
                    "HTTP proxy set failed for {service}: {}",
                    String::from_utf8_lossy(&http.stderr)
                ));
                continue;
            }

            let https = std::process::Command::new("networksetup")
                .args(["-setsecurewebproxy", service, "127.0.0.1", &port_str])
                .output()
                .map_err(|e| format!("Failed to set HTTPS proxy for {service}: {e}"))?;
            if !https.status.success() {
                last_err = Some(format!(
                    "HTTPS proxy set failed for {service}: {}",
                    String::from_utf8_lossy(&https.stderr)
                ));
            }
        }

        if let Some(err) = last_err {
            Err(err)
        } else {
            Ok(())
        }
    }
    #[cfg(target_os = "windows")]
    {
        let proxy_str = format!("127.0.0.1:{}", port);
        // Write to HKCU (no admin required); browsers read this via WinInet.
        let set_server = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyServer",
                "/t", "REG_SZ",
                "/d", &proxy_str,
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to set proxy server: {e}"))?;
        if !set_server.status.success() {
            return Err(format!(
                "reg add ProxyServer failed: {}",
                String::from_utf8_lossy(&set_server.stderr)
            ));
        }
        let set_enable = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
                "/t", "REG_DWORD",
                "/d", "1",
                "/f",
            ])
            .output()
            .map_err(|e| format!("Failed to enable proxy: {e}"))?;
        if !set_enable.status.success() {
            return Err(format!(
                "reg add ProxyEnable failed: {}",
                String::from_utf8_lossy(&set_enable.stderr)
            ));
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Proxy configuration not supported on this platform".to_string())
    }
}

#[tauri::command]
pub fn unconfigure_system_proxy() -> Result<(), String> {
    crate::platform::disable_os_proxy_all_services();
    Ok(())
}

#[tauri::command]
pub fn is_system_proxy_configured(port: u16) -> bool {
    #[cfg(target_os = "macos")]
    {
        let services = crate::platform::list_network_services();
        let port_str = format!("Port: {port}");
        for service in services {
            let out = std::process::Command::new("networksetup")
                .args(["-getwebproxy", &service])
                .output();
            if let Ok(out) = out {
                let text = String::from_utf8_lossy(&out.stdout);
                if text.contains("Enabled: Yes") && text.contains(&port_str) {
                    return true;
                }
            }
        }
        false
    }
    #[cfg(target_os = "windows")]
    {
        // Check HKCU WinInet settings — same place browsers (Chrome/Edge) read from.
        let enabled = std::process::Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyEnable",
            ])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains("0x1"))
            .unwrap_or(false);
        if !enabled {
            return false;
        }
        std::process::Command::new("reg")
            .args([
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
                "/v", "ProxyServer",
            ])
            .output()
            .map(|o| String::from_utf8_lossy(&o.stdout).contains(&format!("127.0.0.1:{}", port)))
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}

#[tauri::command]
pub fn open_log_folder(app: tauri::AppHandle) -> Result<(), String> {
    let log_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("logs");
    std::fs::create_dir_all(&log_dir).map_err(|e| e.to_string())?;
    open::that(&log_dir).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_proxy_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.network?Proxies")
            .spawn()
            .map_err(|e| format!("Failed to open proxy settings: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "ms-settings:network-proxy"])
            .spawn()
            .map_err(|e| format!("Failed to open proxy settings: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("gnome-control-center")
            .arg("network")
            .spawn()
            .map_err(|e| format!("Failed to open network settings: {e}. Open your network settings manually."))?;
        Ok(())
    }
}

#[tauri::command]
pub fn open_cert_manager() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-a", "Keychain Access"])
            .spawn()
            .map_err(|e| format!("Failed to open Keychain Access: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "certmgr.msc"])
            .spawn()
            .map_err(|e| format!("Failed to open Certificate Manager: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Err("Certificate trust configuration varies by Linux distribution. Check your distro's documentation for managing trusted certificates.".to_string())
    }
}
