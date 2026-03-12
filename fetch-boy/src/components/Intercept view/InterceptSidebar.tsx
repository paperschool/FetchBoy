import { useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Settings as SettingsIcon, FolderOpen, Copy } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';

interface CaCertificateInfo {
    certPath: string;
    certExists: boolean;
}

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

    useEffect(() => {
        invoke<CaCertificateInfo>('get_ca_certificate_path')
            .then(setCaCertInfo)
            .catch(() => setCaCertInfo(null));
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

    async function handleOpenCaFolder() {
        if (caCertInfo?.certPath) {
            const caDir = caCertInfo.certPath.substring(0, caCertInfo.certPath.lastIndexOf('/'));
            try {
                await open(caDir);
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
                                        className="flex items-center gap-1 text-xs text-app-muted hover:text-app-inverse"
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
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
