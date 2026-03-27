import { Loader2, Radio } from "lucide-react";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useInterceptStore } from "@/stores/interceptStore";
import { saveSetting } from "@/lib/settings";
import { invoke } from "@tauri-apps/api/core";

export function InterceptTabActions(): React.ReactElement {
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
  const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled);
  const proxyPort = useUiSettingsStore((s) => s.proxyPort);
  const caInstalled = useUiSettingsStore((s) => s.caInstalled);
  const setSidebarCollapsed = useUiSettingsStore((s) => s.setSidebarCollapsed);
  const setSidebarSettingsExpanded = useUiSettingsStore((s) => s.setSidebarSettingsExpanded);
  const setFlashInstallCert = useUiSettingsStore((s) => s.setFlashInstallCert);
  const proxyShuttingDown = useUiSettingsStore((s) => s.proxyShuttingDown);
  const setProxyShuttingDown = useUiSettingsStore((s) => s.setProxyShuttingDown);
  const clearPauseState = useInterceptStore((s) => s.clearPauseState);

  async function handleToggleProxy(): Promise<void> {
    if (proxyShuttingDown) return;

    if (!caInstalled && !proxyEnabled) {
      setSidebarCollapsed(false);
      void saveSetting("sidebar_collapsed", false);
      setSidebarSettingsExpanded(true);
      void saveSetting("sidebar_settings_expanded", true);
      setTimeout(() => setFlashInstallCert(true), 100);
      return;
    }

    if (proxyEnabled) {
      setProxyShuttingDown(true);
      try {
        await invoke("unconfigure_system_proxy");
        await invoke("set_proxy_config", { enabled: false, port: proxyPort });
        setProxyEnabled(false);
        clearPauseState();
        void saveSetting("proxy_enabled", false);
      } catch (err) {
        console.error("Failed to stop proxy:", err);
      } finally {
        setProxyShuttingDown(false);
      }
    } else {
      try {
        await invoke("configure_system_proxy", { port: proxyPort });
        await invoke("set_proxy_config", { enabled: true, port: proxyPort });
        setProxyEnabled(true);
        void saveSetting("proxy_enabled", true);
      } catch (err) {
        console.error("Failed to start proxy:", err);
      }
    }
  }

  const certMissing = !caInstalled && !proxyEnabled;

  return (
    <button
      onClick={() => void handleToggleProxy()}
      disabled={proxyShuttingDown}
      className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
        proxyShuttingDown
          ? "bg-yellow-500/20 text-yellow-400 cursor-wait"
          : proxyEnabled
            ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            : certMissing
              ? "bg-gray-500/20 text-gray-500 hover:bg-gray-500/30 cursor-not-allowed"
              : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
      }`}
      title={
        proxyShuttingDown
          ? "Proxy is shutting down..."
          : proxyEnabled
            ? "Stop intercepting traffic and remove OS proxy configuration"
            : certMissing
              ? "Install CA certificate first to start the proxy"
              : "Configure OS proxy and start intercepting traffic"
      }
    >
      {proxyShuttingDown ? (
        <Loader2 size={13} className="animate-spin" />
      ) : (
        <Radio size={13} className={proxyEnabled ? "animate-pulse" : ""} />
      )}
      {proxyShuttingDown ? "Stopping..." : proxyEnabled ? "Stop Proxy" : "Start Proxy"}
    </button>
  );
}

/** @deprecated Use InterceptTabActions instead */
export function InterceptTopBar() {
  return <InterceptTabActions />;
}
