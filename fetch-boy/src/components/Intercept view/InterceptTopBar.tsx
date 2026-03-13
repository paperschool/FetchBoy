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
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            proxyEnabled
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
          }`}
          title={proxyEnabled ? "Stop intercepting traffic and remove OS proxy configuration" : "Configure OS proxy and start intercepting traffic"}
        >
          <Radio size={13} className={proxyEnabled ? "animate-pulse" : ""} />
          {proxyEnabled ? "Stop Proxy" : "Start Proxy"}
        </button>
      }
    />
  );
}
