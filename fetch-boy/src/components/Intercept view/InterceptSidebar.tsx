import { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Settings as SettingsIcon, FolderOpen, Copy, ShieldCheck, Globe } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';

interface CaCertificateInfo {
    certPath: string;
    certExists: boolean;
}

type InstallStatus = 'idle' | 'loading' | 'success' | 'error';

interface InterceptSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function InterceptSidebar({ collapsed, onToggle }: InterceptSidebarProps) {
    const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
    const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled);
    const proxyPort = useUiSettingsStore((s) => s.proxyPort);
    const setProxyPort = useUiSettingsStore((s) => s.setProxyPort);
    const sidebarSettingsExpanded = useUiSettingsStore((s) => s.sidebarSettingsExpanded);
    const setSidebarSettingsExpanded = useUiSettingsStore((s) => s.setSidebarSettingsExpanded);
    const [caCertInfo, setCaCertInfo] = useState<CaCertificateInfo | null>(null);
    const [caInstalled, setCaInstalled] = useState(false);
    const [proxyConfigured, setProxyConfigured] = useState(false);
    const [certStatus, setCertStatus] = useState<InstallStatus>('idle');
    const [certMessage, setCertMessage] = useState('');
    const [proxyStatus, setProxyStatus] = useState<InstallStatus>('idle');
    const [proxyMessage, setProxyMessage] = useState('');

    useEffect(() => {
        invoke<CaCertificateInfo>('get_ca_certificate_path')
            .then(setCaCertInfo)
            .catch(() => setCaCertInfo(null));
        invoke<boolean>('is_ca_installed')
            .then(setCaInstalled)
            .catch(() => setCaInstalled(false));
        invoke<boolean>('is_system_proxy_configured', { port: proxyPort })
            .then(setProxyConfigured)
            .catch(() => setProxyConfigured(false));
    }, []);

    function handleProxyEnabledChange(e: React.ChangeEvent<HTMLInputElement>) {
        const checked = e.target.checked;
        setProxyEnabled(checked);
        void saveSetting('proxy_enabled', checked);
        void invoke('set_proxy_config', { enabled: checked, port: proxyPort }).catch(() => {});
    }

    function handleProxyPortChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = parseInt(e.target.value, 10);
        const clamped = Math.min(65535, Math.max(1024, isNaN(raw) ? 8080 : raw));
        setProxyPort(clamped);
        void saveSetting('proxy_port', clamped);
        void invoke('set_proxy_config', { enabled: proxyEnabled, port: clamped }).catch(() => {});
    }

    async function handleInstallCert() {
        setCertStatus('loading');
        setCertMessage('');
        try {
            await invoke('install_ca_to_system');
            setCertStatus('success');
            setCertMessage('Certificate installed successfully.');
            setCaInstalled(true);
        } catch (err) {
            setCertStatus('error');
            setCertMessage(String(err));
        }
    }

    async function handleConfigureProxy() {
        setProxyStatus('loading');
        setProxyMessage('');
        try {
            await invoke('configure_system_proxy', { port: proxyPort });
            setProxyStatus('success');
            setProxyMessage('System proxy configured successfully.');
            setProxyConfigured(true);
        } catch (err) {
            setProxyStatus('error');
            setProxyMessage(String(err));
        }
    }

    async function handleOpenCaFolder() {
        if (caCertInfo?.certPath) {
            const caDir = caCertInfo.certPath.substring(0, caCertInfo.certPath.lastIndexOf('/'));
            try {
                await invoke('open_folder', { path: caDir });
            } catch (err) {
                console.error('Failed to open CA folder:', err);
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
        void saveSetting('sidebar_settings_expanded', next);
    }

    if (collapsed) {
        return (
            <aside
                data-testid="sidebar"
                className="bg-app-sidebar text-app-inverse overflow-hidden p-2 flex flex-col items-center gap-2"
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
                <button
                    type="button"
                    onClick={() => {
                        setSidebarSettingsExpanded(true);
                        void saveSetting('sidebar_settings_expanded', true);
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
            className="bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col"
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
                    <div className={`w-2 h-2 rounded-full ${proxyEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-app-muted">:{proxyPort}</span>
                </div>
            </div>

            <div data-tour="settings-env" className="mt-auto">
                <div className="shrink-0 border-t border-gray-700">
                    <button
                        type="button"
                        className="w-full flex items-center gap-2 p-2 text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors"
                        onClick={handleSettingsToggle}
                        aria-expanded={sidebarSettingsExpanded}
                        aria-controls="settings-accordion-content"
                        data-testid="settings-accordion-toggle"
                    >
                        {sidebarSettingsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <SettingsIcon size={16} />
                        <span className="text-xs font-medium">Settings</span>
                    </button>

                    {sidebarSettingsExpanded && (
                        <div
                            id="settings-accordion-content"
                            className="p-2 space-y-4 overflow-y-auto"
                            data-testid="settings-accordion-content"
                        >
                            {/* Proxy settings - MITM specific */}
                            <div className="space-y-2">
                                <p className="text-app-muted text-xs font-medium">Proxy</p>
                                <label className="flex items-center gap-2 text-app-muted text-xs cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={proxyEnabled}
                                        onChange={handleProxyEnabledChange}
                                        className="rounded"
                                    />
                                    Enable MITM Proxy
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-app-muted w-8">Port</span>
                                    <input
                                        type="number"
                                        min={1024}
                                        max={65535}
                                        value={proxyPort}
                                        onChange={handleProxyPortChange}
                                        disabled={!proxyEnabled}
                                        className="w-16 bg-transparent border border-gray-700 rounded px-2 py-1 text-app-muted text-xs disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            {/* CA Certificate */}
                            {caCertInfo?.certExists && (
                                <div className="space-y-1 pt-2 border-t border-gray-700">
                                    <p className="text-app-muted text-xs font-medium">CA Certificate</p>
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

                            {/* Install Certificate */}
                            <div className="space-y-1 pt-2 border-t border-gray-700">
                                <p className="text-app-muted text-xs font-medium">Setup</p>
                                <button
                                    type="button"
                                    onClick={handleInstallCert}
                                    disabled={caInstalled || certStatus === 'loading'}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={caInstalled ? 'Certificate already installed' : 'Install CA certificate to OS trust store'}
                                >
                                    <ShieldCheck size={12} />
                                    {certStatus === 'loading' ? 'Installing…' : caInstalled ? 'Cert Installed' : 'Install Certificate'}
                                </button>
                                {certMessage && (
                                    <p className={`text-xs px-1 ${certStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                        {certMessage}
                                    </p>
                                )}

                                <button
                                    type="button"
                                    onClick={handleConfigureProxy}
                                    disabled={proxyConfigured || proxyStatus === 'loading'}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={proxyConfigured ? 'System proxy already configured' : 'Configure OS to route traffic through this proxy'}
                                >
                                    <Globe size={12} />
                                    {proxyStatus === 'loading' ? 'Configuring…' : proxyConfigured ? 'Proxy Configured' : 'Configure Proxy'}
                                </button>
                                {proxyMessage && (
                                    <p className={`text-xs px-1 ${proxyStatus === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                                        {proxyMessage}
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
