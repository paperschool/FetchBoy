import { useState, useEffect } from "react";
import {
  Bug, ChevronDown, ChevronLeft, ChevronRight, Route,
  Settings as SettingsIcon,
} from "lucide-react";
import { t } from '@/lib/i18n';
import { BreakpointsTree } from "@/components/Breakpoints/BreakpointsTree";
import { MappingsTree } from "@/components/Mappings/MappingsTree";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useInterceptStore } from "@/stores/interceptStore";
import { saveSetting } from "@/lib/settings";
import { useProxyConfig } from "@/hooks/useProxyConfig";
import { useCertificateManagement } from "@/hooks/useCertificateManagement";
import { useSystemOperations } from "@/hooks/useSystemOperations";
import { ProxyPortConfig } from "./ProxyPortConfig";
import { CertificateManagement } from "./CertificateManagement";

interface CaCertificateInfo { certPath: string; certExists: boolean }
type ActionStatus = "idle" | "loading" | "success" | "error";
type InterceptPanel = "breakpoints" | "mappings" | "settings";

interface InterceptSidebarProps { collapsed: boolean; onToggle: () => void }

export function InterceptSidebar({ collapsed, onToggle }: InterceptSidebarProps) {
  const [activePanel, setActivePanel] = useState<InterceptPanel>("breakpoints");
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
  const proxyPort = useUiSettingsStore((s) => s.proxyPort);
  const breakpointTimeout = useInterceptStore((s) => s.breakpointTimeout);
  const setBreakpointTimeout = useInterceptStore((s) => s.setBreakpointTimeout);
  const setProxyPort = useUiSettingsStore((s) => s.setProxyPort);
  const sidebarSettingsExpanded = useUiSettingsStore((s) => s.sidebarSettingsExpanded);
  const setSidebarSettingsExpanded = useUiSettingsStore((s) => s.setSidebarSettingsExpanded);
  const caInstalled = useUiSettingsStore((s) => s.caInstalled);
  const setCaInstalled = useUiSettingsStore((s) => s.setCaInstalled);
  const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled);
  const clearPauseState = useInterceptStore((s) => s.clearPauseState);
  const [portInput, setPortInput] = useState(String(proxyPort));
  const [caCertInfo, setCaCertInfo] = useState<CaCertificateInfo | null>(null);
  const [certStatus, setCertStatus] = useState<ActionStatus>("idle");
  const [certMessage, setCertMessage] = useState("");
  const { setProxyConfig, unconfigureSystemProxy } = useProxyConfig();
  const { installCert, uninstallCert, deleteCertFiles, verifyCertInstalled, getCaCertificatePath } = useCertificateManagement();
  const { openFolder } = useSystemOperations();

  useEffect(() => {
    getCaCertificatePath().then(setCaCertInfo).catch(() => setCaCertInfo(null));
    verifyCertInstalled().then((installed) => setCaInstalled(installed)).catch(() => setCaInstalled(false));
  }, [setCaInstalled, getCaCertificatePath, verifyCertInstalled]);

  function handleProxyPortInput(e: React.ChangeEvent<HTMLInputElement>) { setPortInput(e.target.value) }
  function handleProxyPortCommit() {
    const raw = parseInt(portInput, 10);
    const clamped = Math.min(65535, Math.max(1024, isNaN(raw) ? 8080 : raw));
    setPortInput(String(clamped)); setProxyPort(clamped);
    void saveSetting("proxy_port", clamped);
    void setProxyConfig(proxyEnabled, clamped);
  }

  async function handleInstallCert() {
    setCertStatus("loading"); setCertMessage("");
    try { await installCert(); setCertStatus("success"); setCertMessage("Certificate installed and trusted successfully."); setCaInstalled(true); }
    catch (err) { setCertStatus("error"); setCertMessage(String(err)); }
  }

  async function handleUninstallCert() {
    setCertStatus("loading"); setCertMessage("");
    try {
      await uninstallCert();
      if (proxyEnabled) {
        await unconfigureSystemProxy(); await setProxyConfig(false, proxyPort);
        setProxyEnabled(false); clearPauseState(); void saveSetting("proxy_enabled", false);
      }
      await deleteCertFiles();
      setCaCertInfo((prev) => prev ? { ...prev, certExists: false } : null);
      setCertStatus("idle"); setCertMessage(""); setCaInstalled(false);
    } catch (err) { setCertStatus("error"); setCertMessage(String(err)); }
  }

  function handleOpenCaFolder() {
    if (caCertInfo?.certPath) {
      const caDir = caCertInfo.certPath.substring(0, caCertInfo.certPath.lastIndexOf("/"));
      openFolder(caDir);
    }
  }
  function handleCopyPath() { if (caCertInfo?.certPath) void navigator.clipboard.writeText(caCertInfo.certPath) }
  function handleSettingsToggle() { const next = !sidebarSettingsExpanded; setSidebarSettingsExpanded(next); void saveSetting("sidebar_settings_expanded", next) }

  if (collapsed) {
    return (
      <aside data-testid="sidebar" className="bg-app-sidebar text-app-inverse overflow-hidden p-2 flex flex-col items-center gap-2 h-full">
        <button type="button" onClick={onToggle} className="p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer" aria-label="Expand sidebar" title="Expand sidebar (Cmd/Ctrl+B)"><ChevronRight size={20} className="text-app-muted" /></button>
        <div className={`w-2 h-2 rounded-full mt-2 ${proxyEnabled ? "bg-green-500" : "bg-gray-500"}`} title={proxyEnabled ? t('intercept.proxyActive') : t('intercept.proxyInactive')} />
        <button type="button" onClick={() => { setActivePanel("breakpoints"); onToggle() }} className="p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer" aria-label="Breakpoints" title={t('breakpoints.title')}><Bug size={20} className="text-app-muted" /></button>
        <button type="button" onClick={() => { setActivePanel("mappings"); onToggle() }} className="p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer" aria-label="Mappings" title={t('mappings.title')}><Route size={20} className="text-app-muted" /></button>
        <button type="button" onClick={() => { setSidebarSettingsExpanded(true); void saveSetting("sidebar_settings_expanded", true); onToggle() }} className="p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer mt-auto" aria-label="Settings" title={t('settings.title')} data-testid="collapsed-settings-button"><SettingsIcon size={20} className="text-app-muted" /></button>
      </aside>
    );
  }

  return (
    <aside data-testid="sidebar" className="bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onToggle} className="p-1.5 hover:bg-gray-700 rounded transition-colors cursor-pointer" aria-label="Collapse sidebar" title="Collapse sidebar (Cmd/Ctrl+B)"><ChevronLeft size={18} className="text-app-muted" /></button>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${proxyEnabled ? "bg-green-500" : "bg-gray-500"}`} />
          {proxyEnabled ? <span className="text-xs text-green-500 font-medium">{t('intercept.proxyActive')}</span> : <span className="text-xs text-app-muted">:{proxyPort}</span>}
        </div>
      </div>

      <div className="flex shrink-0 mb-3 rounded overflow-hidden border border-gray-700">
        <button type="button" onClick={() => setActivePanel("breakpoints")} data-tour="breakpoints-panel" className={`flex-1 py-1.5 text-xs cursor-pointer ${activePanel === "breakpoints" ? "bg-gray-700 text-app-inverse font-medium" : "text-app-muted hover:text-app-inverse"}`} aria-label="Breakpoints panel">{t('breakpoints.title')}</button>
        <button type="button" onClick={() => setActivePanel("mappings")} data-tour="mappings-panel" className={`flex-1 py-1.5 text-xs cursor-pointer ${activePanel === "mappings" ? "bg-gray-700 text-app-inverse font-medium" : "text-app-muted hover:text-app-inverse"}`} aria-label="Mappings panel">{t('mappings.title')}</button>
      </div>

      {activePanel === "breakpoints" && <div className="flex-1 min-h-0 overflow-y-auto"><BreakpointsTree /></div>}
      {activePanel === "mappings" && <div className="flex-1 min-h-0 overflow-y-auto"><MappingsTree /></div>}

      <div data-tour="settings-env" className="mt-auto">
        <div data-tour="intercept-settings" className="shrink-0 border-t border-gray-700">
          <button type="button" className="w-full flex items-center gap-2 p-2 text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer" onClick={handleSettingsToggle} aria-expanded={sidebarSettingsExpanded} aria-controls="settings-accordion-content" data-testid="settings-accordion-toggle">
            {sidebarSettingsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <SettingsIcon size={16} /><span className="text-xs font-medium">{t('settings.title')}</span>
          </button>
          {sidebarSettingsExpanded && (
            <div id="settings-accordion-content" className="p-2 space-y-4 overflow-y-auto" data-testid="settings-accordion-content">
              <ProxyPortConfig portInput={portInput} proxyEnabled={proxyEnabled} breakpointTimeout={breakpointTimeout} onPortInput={handleProxyPortInput} onPortCommit={handleProxyPortCommit} onTimeoutChange={setBreakpointTimeout} />
              <CertificateManagement caCertInfo={caCertInfo} caInstalled={caInstalled} certStatus={certStatus} certMessage={certMessage} onInstall={handleInstallCert} onUninstall={handleUninstallCert} onOpenFolder={handleOpenCaFolder} onCopyPath={handleCopyPath} />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
