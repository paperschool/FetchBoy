import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';

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

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={onClose}
            data-testid="settings-overlay"
        >
            <div
                className="bg-app-main border border-app-subtle rounded-lg p-6 w-96 space-y-6 shadow-xl"
                onClick={(e) => e.stopPropagation()}
                data-testid="settings-panel"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-app-primary font-semibold text-base">Settings</h2>
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
            </div>
        </div>
    );
}
