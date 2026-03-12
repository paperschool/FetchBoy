import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings as SettingsIcon, FolderOpen, Copy } from 'lucide-react';
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
    const [caCertInfo, setCaCertInfo] = useState<CaCertificateInfo | null>(null);
    const [settingsExpanded, setSettingsExpanded] = useState(false);

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

    if (collapsed) {
        return (
            <aside className="bg-app-sidebar flex flex-col items-center py-2 gap-2">
                <button
                    onClick={onToggle}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    title="Expand sidebar"
                >
                    <ChevronRight size={18} className="text-app-muted" />
                </button>
                <div className="flex-1" />
                <button
                    onClick={() => { setSettingsExpanded(true); onToggle(); }}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    title="Settings"
                >
                    <SettingsIcon size={18} className="text-app-muted" />
                </button>
            </aside>
        );
    }

    return (
        <aside className="bg-app-sidebar flex flex-col">
            {/* Header with collapse button and proxy status */}
            <div className="flex items-center justify-between p-2 border-b border-gray-700">
                <button
                    onClick={onToggle}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Collapse sidebar"
                >
                    <ChevronLeft size={16} className="text-app-muted" />
                </button>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${proxyEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs text-app-muted">:{proxyPort}</span>
                </div>
            </div>
            
            {/* Main content area - empty for now, could add intercept-specific items */}
            <div className="flex-1" />
            
            {/* Settings accordion at bottom */}
            <div className="border-t border-gray-700">
                <button
                    onClick={() => setSettingsExpanded(!settingsExpanded)}
                    className="w-full flex items-center gap-2 p-2 text-app-muted hover:text-app-inverse hover:bg-gray-700 transition-colors"
                >
                    {settingsExpanded ? <ChevronRight size={14} /> : <SettingsIcon size={14} />}
                    <span className="text-xs font-medium">Settings</span>
                </button>
                
                {settingsExpanded && (
                    <div className="p-2 space-y-2 bg-gray-800">
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
                                className="w-16 bg-transparent border border-gray-600 rounded px-1 py-0.5 text-xs text-app-muted disabled:opacity-50"
                            />
                        </div>
                        {caCertInfo?.certExists && (
                            <div className="pt-2 border-t border-gray-700 space-y-1">
                                <p className="text-xs text-app-muted font-medium">CA Certificate</p>
                                <button
                                    onClick={handleOpenCaFolder}
                                    className="flex items-center gap-1 text-xs text-app-muted hover:text-app-inverse"
                                >
                                    <FolderOpen size={10} /> Open Folder
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
                                        <Copy size={10} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
