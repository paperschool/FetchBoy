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

/// Raises this process's open-file soft limit to its hard limit (or a sane
/// fallback if the hard limit is unbounded). The proxy can hold many
/// concurrent connections when the whole machine's traffic is routed through
/// it, and macOS's default per-process soft limit of 256 is easily exhausted
/// during normal use — not just failing new proxy connections, but also
/// unrelated subprocess calls like disabling the OS proxy on exit (EMFILE,
/// "Too many open files").
#[cfg(unix)]
pub fn raise_fd_limit() {
    const FALLBACK_MAX: libc::rlim_t = 10_240;

    let mut lim = libc::rlimit { rlim_cur: 0, rlim_max: 0 };
    // SAFETY: `lim` is a valid, correctly-sized out-parameter for getrlimit.
    if unsafe { libc::getrlimit(libc::RLIMIT_NOFILE, &mut lim) } != 0 {
        log::warn!(
            "Failed to read RLIMIT_NOFILE: {}",
            std::io::Error::last_os_error()
        );
        return;
    }

    let target = if lim.rlim_max == libc::RLIM_INFINITY {
        FALLBACK_MAX
    } else {
        lim.rlim_max
    };
    if lim.rlim_cur >= target {
        return;
    }

    let raised = libc::rlimit { rlim_cur: target, rlim_max: lim.rlim_max };
    // SAFETY: `raised` only raises the soft limit, capped at the process's own hard limit.
    if unsafe { libc::setrlimit(libc::RLIMIT_NOFILE, &raised) } != 0 {
        log::warn!(
            "Failed to raise RLIMIT_NOFILE to {target}: {}",
            std::io::Error::last_os_error()
        );
    } else {
        log::info!("Raised open-file limit from {} to {target}", lim.rlim_cur);
    }
}

/// Windows has a much higher default per-process handle limit; nothing to do.
#[cfg(not(unix))]
pub fn raise_fd_limit() {}

#[cfg(all(test, unix))]
mod tests {
    use super::*;

    #[test]
    fn raise_fd_limit_never_lowers_the_soft_limit() {
        let mut before = libc::rlimit { rlim_cur: 0, rlim_max: 0 };
        unsafe { libc::getrlimit(libc::RLIMIT_NOFILE, &mut before) };

        raise_fd_limit();

        let mut after = libc::rlimit { rlim_cur: 0, rlim_max: 0 };
        unsafe { libc::getrlimit(libc::RLIMIT_NOFILE, &mut after) };
        assert!(after.rlim_cur >= before.rlim_cur);
    }
}

