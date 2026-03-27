use crate::ProxyRestartInfo;
use crate::cert;

#[tauri::command]
pub fn get_ca_certificate_path(restart_info: tauri::State<'_, ProxyRestartInfo>) -> serde_json::Value {
    let ca_dir = restart_info.app_data_dir.join("ca");
    let cert_path = ca_dir.join("ca.pem");
    serde_json::json!({
        "certPath": cert_path.to_string_lossy(),
        "certExists": cert_path.exists()
    })
}

#[tauri::command]
pub fn install_ca_to_system(
    app: tauri::AppHandle,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app; // icon resolved via system caution icon instead

        cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA: {e}"))?;

        let cert_path = restart_info.app_data_dir.join("ca").join("ca.pem");
        let cert_str = cert_path.to_string_lossy();
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
        let login_keychain = format!("{}/Library/Keychains/login.keychain-db", home);

        // Single osascript: show confirmation dialog, then elevated import to
        // System keychain — one admin prompt covers both.
        let script = format!(
            "display dialog \
             \"FetchBoy needs to install its CA certificate to intercept HTTPS traffic.\" \
             & return & return & \
             \"macOS will ask for your password or Touch ID to authorize this.\" \
             with title \"FetchBoy — Install CA Certificate\" \
             buttons {{\"Cancel\", \"Install\"}} \
             default button \"Install\" \
             cancel button \"Cancel\" \
             with icon caution\n\
             do shell script \"/usr/bin/security import '{}' -k /Library/Keychains/System.keychain -A\" \
             with administrator privileges",
            cert_str.replace('\'', "'\\''")
        );

        let result = std::process::Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|e| format!("Failed to install certificate: {e}"))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            if stderr.contains("User canceled") || stderr.contains("(-128)") {
                return Err("Installation cancelled.".to_string());
            }
            if !stderr.contains("already exists") {
                return Err(format!("Certificate install failed: {}", stderr));
            }
        }

        // Also set trust in login keychain (best-effort, no elevation needed)
        let _ = std::process::Command::new("/usr/bin/security")
            .args(["add-trusted-cert", "-r", "trustRoot", "-k", &login_keychain, &cert_str])
            .output();

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let ca = cert::CertificateAuthority::load_or_create(restart_info.app_data_dir.clone())
            .map_err(|e| format!("Failed to load CA: {e}"))?;
        ca.install_to_system().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn uninstall_ca_from_system(
    app: tauri::AppHandle,
    restart_info: tauri::State<'_, ProxyRestartInfo>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = app;

        let pre_dialog =
            "display dialog \
             \"This will remove the FetchBoy CA certificate from your keychain.\" \
             & return & return & \
             \"HTTPS interception will stop working until the certificate is reinstalled.\" \
             with title \"FetchBoy \u{2014} Remove CA Certificate\" \
             buttons {\"Cancel\", \"Remove\"} \
             default button \"Remove\" \
             cancel button \"Cancel\" \
             with icon caution";

        let confirm = std::process::Command::new("osascript")
            .args(["-e", pre_dialog])
            .current_dir("/tmp")
            .output()
            .map_err(|e| format!("Failed to show dialog: {e}"))?;

        if !confirm.status.success() {
            return Err("Removal cancelled.".to_string());
        }

        // Remove from all keychains where the cert may exist.
        // Try System keychain first (where install now puts it), then login keychain (legacy).
        let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/Shared".to_string());
        let login_keychain = format!("{}/Library/Keychains/login.keychain-db", home);

        for keychain in ["/Library/Keychains/System.keychain", login_keychain.as_str()] {
            // Try to delete by common name — ignore errors (cert may not be in this keychain)
            let _ = std::process::Command::new("/usr/bin/security")
                .args(["delete-certificate", "-c", "FetchBoy Proxy CA", keychain])
                .current_dir("/tmp")
                .output();
        }

        // Also remove admin trust domain entries if cert file still exists
        let app_data_dir = restart_info.app_data_dir.clone();
        let cert_path = app_data_dir.join("ca").join("ca.pem");
        if cert_path.exists() {
            let _ = std::process::Command::new("/usr/bin/security")
                .args(["remove-trusted-cert", "-d", &cert_path.to_string_lossy()])
                .current_dir("/tmp")
                .output();
        }

        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("Certificate removal not supported on this platform".to_string())
    }
}

#[tauri::command]
pub fn delete_ca_files(restart_info: tauri::State<'_, ProxyRestartInfo>) -> Result<(), String> {
    let ca_dir = restart_info.app_data_dir.join("ca");
    let cert_path = ca_dir.join("ca.pem");
    let key_path = ca_dir.join("ca-key.pem");

    if cert_path.exists() {
        std::fs::remove_file(&cert_path)
            .map_err(|e| format!("Failed to delete ca.pem: {e}"))?;
    }
    if key_path.exists() {
        std::fs::remove_file(&key_path)
            .map_err(|e| format!("Failed to delete ca-key.pem: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn is_ca_installed() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Search all keychains in the default search list (user + system).
        std::process::Command::new("/usr/bin/security")
            .args(["find-certificate", "-c", "FetchBoy Proxy CA"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("certutil")
            .args(["-store", "-user", "Root", "FetchBoy Proxy CA"])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        false
    }
}
