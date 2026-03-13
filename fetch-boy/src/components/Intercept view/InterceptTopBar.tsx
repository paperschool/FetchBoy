import { Radio } from "lucide-react";
import { AppTopBar } from "@/components/Layout/AppTopBar";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { saveSetting } from "@/lib/settings";
import { invoke } from "@tauri-apps/api/core";

export function InterceptTopBar() {
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
  const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled);
  const proxyPort = useUiSettingsStore((s) => s.proxyPort);

  async function handleToggleProxy() {
    if (proxyEnabled) {
      try {
        await invoke("unconfigure_system_proxy");
        await invoke("set_proxy_config", { enabled: false, port: proxyPort });
        setProxyEnabled(false);
        void saveSetting("proxy_enabled", false);
      } catch (err) {
        console.error("Failed to stop proxy:", err);
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

  return (
    <AppTopBar
      title="Intercept Boy 🛡️"
      actions={
        <button
          onClick={handleToggleProxy}
          className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
            proxyEnabled
              ? "text-red-400 hover:text-red-300 hover:bg-gray-700 rounded"
              : "text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded"
          }`}
          title={proxyEnabled ? "Stop intercepting traffic and remove OS proxy configuration" : "Configure OS proxy and start intercepting traffic"}
        >
          <Radio size={12} className={proxyEnabled ? "animate-pulse" : ""} />
          {proxyEnabled ? "Stop Proxy" : "Start Proxy"}
        </button>
      }
    />
  );
}
