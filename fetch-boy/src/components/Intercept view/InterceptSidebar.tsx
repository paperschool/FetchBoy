import { useState, useEffect } from "react";
import {
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings as SettingsIcon,
  FolderOpen,
  Copy,
  ShieldCheck,
} from "lucide-react";
import { BreakpointsTree } from "@/components/Breakpoints/BreakpointsTree";
import { invoke } from "@tauri-apps/api/core";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { saveSetting } from "@/lib/settings";

interface CaCertificateInfo {
  certPath: string;
  certExists: boolean;
}

type ActionStatus = "idle" | "loading" | "success" | "error";
type InterceptPanel = "breakpoints" | "settings";

interface InterceptSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function InterceptSidebar({
  collapsed,
  onToggle,
}: InterceptSidebarProps) {
  const [activePanel, setActivePanel] = useState<InterceptPanel>("breakpoints");
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
  const proxyPort = useUiSettingsStore((s) => s.proxyPort);
  const setProxyPort = useUiSettingsStore((s) => s.setProxyPort);
  const sidebarSettingsExpanded = useUiSettingsStore(
    (s) => s.sidebarSettingsExpanded,
  );
  const setSidebarSettingsExpanded = useUiSettingsStore(
    (s) => s.setSidebarSettingsExpanded,
  );
  const [caCertInfo, setCaCertInfo] = useState<CaCertificateInfo | null>(null);
  const [caInstalled, setCaInstalled] = useState(false);
  const [certStatus, setCertStatus] = useState<ActionStatus>("idle");
  const [certMessage, setCertMessage] = useState("");

  useEffect(() => {
    invoke<CaCertificateInfo>("get_ca_certificate_path")
      .then(setCaCertInfo)
      .catch(() => setCaCertInfo(null));
    invoke<boolean>("is_ca_installed")
      .then(setCaInstalled)
      .catch(() => setCaInstalled(false));
  }, []);

  function handleProxyPortChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseInt(e.target.value, 10);
    const clamped = Math.min(65535, Math.max(1024, isNaN(raw) ? 8080 : raw));
    setProxyPort(clamped);
    void saveSetting("proxy_port", clamped);
    void invoke("set_proxy_config", {
      enabled: proxyEnabled,
      port: clamped,
    }).catch(() => {});
  }

  async function handleInstallCert() {
    setCertStatus("loading");
    setCertMessage("");
    try {
      await invoke("install_ca_to_system");
      setCertStatus("success");
      setCertMessage("Certificate installed and trusted successfully.");
      setCaInstalled(true);
    } catch (err) {
      setCertStatus("error");
      setCertMessage(String(err));
    }
  }

  async function handleUninstallCert() {
    setCertStatus("loading");
    setCertMessage("");
    try {
      await invoke("uninstall_ca_from_system");
      setCertStatus("idle");
      setCertMessage("");
      setCaInstalled(false);
    } catch (err) {
      setCertStatus("error");
      setCertMessage(String(err));
    }
  }

  async function handleOpenCaFolder() {
    if (caCertInfo?.certPath) {
      const caDir = caCertInfo.certPath.substring(
        0,
        caCertInfo.certPath.lastIndexOf("/"),
      );
      try {
        await invoke("open_folder", { path: caDir });
      } catch (err) {
        console.error("Failed to open CA folder:", err);
      }
    }
  }

  function handleCopyPath() {
    if (caCertInfo?.certPath) {
      void navigator.clipboard.writeText(caCertInfo.certPath);
    }
  }

  function handleSettingsToggle() {
    const next = !sidebarSettingsExpanded;
    setSidebarSettingsExpanded(next);
    void saveSetting("sidebar_settings_expanded", next);
  }

  if (collapsed) {
    return (
      <aside
        data-testid="sidebar"
        className="bg-app-sidebar text-app-inverse overflow-hidden p-2 flex flex-col items-center gap-2 h-full"
      >
        <button
          type="button"
          onClick={onToggle}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar (Cmd/Ctrl+B)"
        >
          <ChevronRight size={20} className="text-app-muted" />
        </button>
        <div
          className={`w-2 h-2 rounded-full mt-2 ${proxyEnabled ? "bg-green-500" : "bg-gray-500"}`}
          title={proxyEnabled ? "Proxy Active" : "Proxy Inactive"}
        />
        <button
          type="button"
          onClick={() => {
            setActivePanel("breakpoints");
            onToggle();
          }}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          aria-label="Breakpoints"
          title="Breakpoints"
        >
          <Bug size={20} className="text-app-muted" />
        </button>
        <button
          type="button"
          onClick={() => {
            setSidebarSettingsExpanded(true);
            void saveSetting("sidebar_settings_expanded", true);
            onToggle();
          }}
          className="p-2 hover:bg-gray-700 rounded transition-colors mt-auto"
          aria-label="Settings"
          title="Settings"
          data-testid="collapsed-settings-button"
        >
          <SettingsIcon size={20} className="text-app-muted" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      data-testid="sidebar"
      className="bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col h-full"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          aria-label="Collapse sidebar"
          title="Collapse sidebar (Cmd/Ctrl+B)"
        >
          <ChevronLeft size={18} className="text-app-muted" />
        </button>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${proxyEnabled ? "bg-green-500" : "bg-gray-500"}`}
          />
          {proxyEnabled ? (
            <span className="text-xs text-green-500 font-medium">
              Proxy Active
            </span>
          ) : (
            <span className="text-xs text-app-muted">:{proxyPort}</span>
          )}
        </div>
      </div>

      {/* Panel tabs */}
      <div className="flex shrink-0 mb-3 rounded overflow-hidden border border-gray-700">
        <button
          type="button"
          onClick={() => setActivePanel("breakpoints")}
          className={`flex-1 py-1.5 text-xs cursor-pointer ${
            activePanel === "breakpoints"
              ? "bg-gray-700 text-app-inverse font-medium"
              : "text-app-muted hover:text-app-inverse"
          }`}
          aria-label="Breakpoints panel"
        >
          Breakpoints
        </button>
      </div>

      {/* Panel content */}
      {activePanel === "breakpoints" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <BreakpointsTree />
        </div>
      )}

      <div data-tour="settings-env" className="mt-auto">
        <div data-tour="intercept-settings" className="shrink-0 border-t border-gray-700">
          <button
            type="button"
            className="w-full flex items-center gap-2 p-2 text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors"
            onClick={handleSettingsToggle}
            aria-expanded={sidebarSettingsExpanded}
            aria-controls="settings-accordion-content"
            data-testid="settings-accordion-toggle"
          >
            {sidebarSettingsExpanded ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )}
            <SettingsIcon size={16} />
            <span className="text-xs font-medium">Settings</span>
          </button>

          {sidebarSettingsExpanded && (
            <div
              id="settings-accordion-content"
              className="p-2 space-y-4 overflow-y-auto"
              data-testid="settings-accordion-content"
            >
              {/* Proxy port */}
              <div className="space-y-2">
                <p className="text-app-muted text-xs font-medium">Proxy</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-app-muted w-8">Port</span>
                  <input
                    type="number"
                    min={1024}
                    max={65535}
                    value={proxyPort}
                    onChange={handleProxyPortChange}
                    disabled={proxyEnabled}
                    className="w-16 bg-transparent border border-gray-700 rounded px-2 py-1 text-app-muted text-xs disabled:opacity-50"
                  />
                </div>
              </div>

              {/* CA Certificate */}
              {caCertInfo?.certExists && (
                <div className="space-y-1 pt-2 border-t border-gray-700">
                  <p className="text-app-muted text-xs font-medium">
                    CA Certificate
                  </p>
                  <button
                    onClick={handleOpenCaFolder}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer"
                  >
                    <FolderOpen size={12} /> Open Folder
                  </button>
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-app-muted opacity-70 truncate flex-1">
                      {caCertInfo.certPath}
                    </p>
                    <button
                      onClick={handleCopyPath}
                      className="text-app-muted hover:text-app-inverse shrink-0"
                      title="Copy path"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              )}

              {/* Setup actions */}
              <div className="space-y-1 pt-2 border-t border-gray-700">
                <p className="text-app-muted text-xs font-medium">Setup</p>

                {/* Install / Uninstall Certificate */}
                {caInstalled ? (
                  <button
                    type="button"
                    onClick={handleUninstallCert}
                    disabled={certStatus === "loading"}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Remove CA certificate from OS trust store"
                  >
                    <ShieldCheck size={12} />
                    {certStatus === "loading" ? "Removing…" : "Uninstall Certificate"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleInstallCert}
                    disabled={certStatus === "loading"}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Install CA certificate to OS trust store"
                  >
                    <ShieldCheck size={12} />
                    {certStatus === "loading" ? "Installing…" : "Install Certificate"}
                  </button>
                )}
                {certMessage && (
                  <p
                    className={`text-xs px-1 ${certStatus === "error" ? "text-red-400" : "text-green-400"}`}
                  >
                    {certMessage}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
