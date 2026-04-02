import { Settings } from 'lucide-react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useProxyConfig } from '@/hooks/useProxyConfig';
import { saveSetting } from '@/lib/settings';
import { useTourStore } from '@/stores/tourStore';
import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts';

interface SettingsPanelProps {
    open: boolean;
    onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
    const theme = useUiSettingsStore((s) => s.theme);
    const setTheme = useUiSettingsStore((s) => s.setTheme);
    const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs);
    const setRequestTimeoutMs = useUiSettingsStore((s) => s.setRequestTimeoutMs);
    const sslVerify = useUiSettingsStore((s) => s.sslVerify);
    const setSslVerify = useUiSettingsStore((s) => s.setSslVerify);
    const editorFontSize = useUiSettingsStore((s) => s.editorFontSize);
    const setEditorFontSize = useUiSettingsStore((s) => s.setEditorFontSize);
    const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);
    const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled);
    const proxyPort = useUiSettingsStore((s) => s.proxyPort);
    const setProxyPort = useUiSettingsStore((s) => s.setProxyPort);
    const resetTour = useTourStore((s) => s.resetTour);
    const { setProxyConfig } = useProxyConfig();
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

    if (!open) return null;

    function handleThemeChange(value: 'light' | 'dark' | 'system') {
        setTheme(value);
        void saveSetting('theme', value);
    }

    function handleTimeoutChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = parseInt(e.target.value, 10);
        const clamped = Math.min(300000, Math.max(100, isNaN(raw) ? 100 : raw));
        setRequestTimeoutMs(clamped);
        void saveSetting('request_timeout_ms', clamped);
    }

    function handleSslVerifyChange(e: React.ChangeEvent<HTMLInputElement>) {
        const checked = e.target.checked;
        setSslVerify(checked);
        void saveSetting('ssl_verify', checked);
    }

    function handleFontSizeDecrease() {
        const next = Math.max(10, editorFontSize - 1);
        if (next === editorFontSize) return;
        setEditorFontSize(next);
        void saveSetting('editor_font_size', next);
    }

    function handleFontSizeIncrease() {
        const next = Math.min(24, editorFontSize + 1);
        if (next === editorFontSize) return;
        setEditorFontSize(next);
        void saveSetting('editor_font_size', next);
    }

    function handleProxyEnabledChange(e: React.ChangeEvent<HTMLInputElement>) {
        const checked = e.target.checked;
        setProxyEnabled(checked);
        void saveSetting('proxy_enabled', checked);
        void setProxyConfig(checked, proxyPort);
    }

    function handleProxyPortChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = parseInt(e.target.value, 10);
        const clamped = Math.min(65535, Math.max(1024, isNaN(raw) ? 8080 : raw));
        setProxyPort(clamped);
        void saveSetting('proxy_port', clamped);
        void setProxyConfig(proxyEnabled, clamped);
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={onClose}
            data-testid="settings-overlay"
        >
            <div
                className="bg-app-main border border-app-subtle rounded-lg p-6 w-96 space-y-6 shadow-xl max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                data-testid="settings-panel"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Settings size={22} className="text-app-primary" />
                        <h2 className="text-app-primary font-semibold text-base">Settings</h2>
                    </div>
                    <button
                        aria-label="Close settings"
                        onClick={onClose}
                        className="text-app-primary opacity-60 hover:opacity-100 text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* Theme section */}
                <div className="space-y-2">
                    <p className="text-app-primary text-sm font-medium">Theme</p>
                    <div className="flex gap-4">
                        {(['light', 'dark', 'system'] as const).map((option) => (
                            <label key={option} className="flex items-center gap-1.5 text-app-primary text-sm cursor-pointer">
                                <input
                                    type="radio"
                                    name="theme"
                                    value={option}
                                    checked={theme === option}
                                    onChange={() => handleThemeChange(option)}
                                    data-testid={`theme-radio-${option}`}
                                />
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Request timeout section */}
                <div className="space-y-2">
                    <p className="text-app-primary text-sm font-medium">Request Timeout (ms)</p>
                    <input
                        type="number"
                        min={100}
                        max={300000}
                        step={100}
                        value={requestTimeoutMs}
                        onChange={handleTimeoutChange}
                        className="w-full bg-app-main border border-app-subtle rounded px-2 py-1 text-app-primary text-sm"
                        data-testid="timeout-input"
                    />
                </div>

                {/* SSL verify section */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-app-primary text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={sslVerify}
                            onChange={handleSslVerifyChange}
                            data-testid="ssl-verify-checkbox"
                        />
                        Verify SSL Certificates
                    </label>
                </div>

                {/* Editor font size section */}
                <div className="space-y-2">
                    <p className="text-app-primary text-sm font-medium">Editor Font Size</p>
                    <div className="flex items-center gap-3">
                        <button
                            aria-label="Decrease font size"
                            onClick={handleFontSizeDecrease}
                            className="text-app-primary border border-app-subtle rounded w-7 h-7 flex items-center justify-center hover:bg-black/10"
                            data-testid="font-size-decrease"
                        >
                            −
                        </button>
                        <span className="text-app-primary text-sm w-6 text-center" data-testid="font-size-value">
                            {editorFontSize}
                        </span>
                        <button
                            aria-label="Increase font size"
                            onClick={handleFontSizeIncrease}
                            className="text-app-primary border border-app-subtle rounded w-7 h-7 flex items-center justify-center hover:bg-black/10"
                            data-testid="font-size-increase"
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* Proxy intercept section */}
                <div className="space-y-2" data-testid="proxy-section">
                    <p className="text-app-primary text-sm font-medium">Proxy Intercept</p>
                    <label className="flex items-center gap-2 text-app-primary text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={proxyEnabled}
                            onChange={handleProxyEnabledChange}
                            data-testid="proxy-enabled-checkbox"
                        />
                        Enable MITM Proxy
                    </label>
                    <div className="flex items-center gap-2">
                        <label className="text-app-secondary text-sm w-10">Port</label>
                        <input
                            type="number"
                            min={1024}
                            max={65535}
                            value={proxyPort}
                            onChange={handleProxyPortChange}
                            disabled={!proxyEnabled}
                            className="w-24 bg-app-main border border-app-subtle rounded px-2 py-1 text-app-primary text-sm disabled:opacity-50"
                            data-testid="proxy-port-input"
                        />
                    </div>
                    <p className="text-app-secondary text-xs">
                        Configure your system to use <span className="font-mono">127.0.0.1:{proxyPort}</span> as
                        an HTTP proxy to capture traffic.
                    </p>
                </div>

                {/* Tutorial section */}
                <div className="space-y-2" data-testid="tutorial-section">
                    <p className="text-app-primary text-sm font-medium">Tutorial</p>
                    <button
                        type="button"
                        onClick={() => { resetTour(); onClose(); }}
                        className="w-full text-left px-3 py-2 text-sm border border-app-subtle rounded text-app-primary hover:bg-black/10 cursor-pointer transition-colors"
                        data-testid="restart-tutorial-button"
                    >
                        Restart Tutorial
                    </button>
                </div>

                {/* Keyboard shortcuts section */}
                <div className="space-y-2" data-testid="keyboard-shortcuts-section">
                    <p className="text-app-primary text-sm font-medium">Keyboard Shortcuts</p>
                    <dl className="space-y-1 text-sm" data-testid="keyboard-shortcuts-list">
                        {KEYBOARD_SHORTCUTS.map((shortcut) => (
                            <div key={shortcut.id} className="flex justify-between">
                                <dt className="text-app-secondary">{shortcut.displayName}</dt>
                                <dd className="text-app-primary font-mono text-xs">
                                    {getShortcutDisplay(isMac, shortcut)}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    );
}
