import { ChevronDown, ChevronRight, Settings as SettingsIcon } from 'lucide-react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';
import { useTourStore } from '@/stores/tourStore';
import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts';
import { t } from '@/lib/i18n';

interface SettingsAccordionProps {
    isExpanded: boolean;
    onToggle: () => void;
}

export function SettingsAccordion({ isExpanded, onToggle }: SettingsAccordionProps) {
    const theme = useUiSettingsStore((s) => s.theme);
    const setTheme = useUiSettingsStore((s) => s.setTheme);
    const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs);
    const setRequestTimeoutMs = useUiSettingsStore((s) => s.setRequestTimeoutMs);
    const sslVerify = useUiSettingsStore((s) => s.sslVerify);
    const setSslVerify = useUiSettingsStore((s) => s.setSslVerify);
    const editorFontSize = useUiSettingsStore((s) => s.editorFontSize);
    const setEditorFontSize = useUiSettingsStore((s) => s.setEditorFontSize);
    const resetTour = useTourStore((s) => s.resetTour);
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

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
        <div className="shrink-0 border-t border-gray-700" data-testid="settings-accordion">
            <button
                type="button"
                className="w-full flex items-center gap-2 p-2 text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors"
                onClick={onToggle}
                aria-expanded={isExpanded}
                aria-controls="settings-accordion-content"
                data-testid="settings-accordion-toggle"
            >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <SettingsIcon size={16} />
                <span className="text-xs font-medium">{t('settings.title')}</span>
            </button>

            {isExpanded && (
                <div
                    id="settings-accordion-content"
                    className="p-2 space-y-4 overflow-y-auto"
                    data-testid="settings-accordion-content"
                >
                    {/* Theme */}
                    <div className="space-y-1">
                        <p className="text-app-muted text-xs font-medium">{t('settings.theme')}</p>
                        <div className="flex gap-3 flex-wrap">
                            {(['light', 'dark', 'system'] as const).map((option) => (
                                <label
                                    key={option}
                                    className="flex items-center gap-1 text-app-muted text-xs cursor-pointer"
                                >
                                    <input
                                        type="radio"
                                        name="sidebar-theme"
                                        value={option}
                                        checked={theme === option}
                                        onChange={() => handleThemeChange(option)}
                                        data-testid={`sidebar-theme-radio-${option}`}
                                    />
                                    {option.charAt(0).toUpperCase() + option.slice(1)}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Request timeout */}
                    <div className="space-y-1">
                        <p className="text-app-muted text-xs font-medium">{t('settings.requestTimeout')}</p>
                        <input
                            type="number"
                            min={100}
                            max={300000}
                            step={100}
                            value={requestTimeoutMs}
                            onChange={handleTimeoutChange}
                            className="w-full bg-transparent border border-gray-700 rounded px-2 py-1 text-app-muted text-xs"
                            data-testid="sidebar-timeout-input"
                        />
                    </div>

                    {/* SSL verify */}
                    <div>
                        <label className="flex items-center gap-2 text-app-muted text-xs cursor-pointer">
                            <input
                                type="checkbox"
                                checked={sslVerify}
                                onChange={handleSslVerifyChange}
                                data-testid="sidebar-ssl-verify-checkbox"
                            />
                            {t('settings.sslVerify')}
                        </label>
                    </div>

                    {/* Editor font size */}
                    <div className="space-y-1">
                        <p className="text-app-muted text-xs font-medium">{t('settings.editorFontSize')}</p>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                aria-label="Decrease font size"
                                onClick={handleFontSizeDecrease}
                                className="text-app-muted border border-gray-700 rounded w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs"
                                data-testid="sidebar-font-size-decrease"
                            >
                                −
                            </button>
                            <span
                                className="text-app-muted text-xs w-5 text-center"
                                data-testid="sidebar-font-size-value"
                            >
                                {editorFontSize}
                            </span>
                            <button
                                type="button"
                                aria-label="Increase font size"
                                onClick={handleFontSizeIncrease}
                                className="text-app-muted border border-gray-700 rounded w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs"
                                data-testid="sidebar-font-size-increase"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Tutorial */}
                    <div className="space-y-1" data-testid="sidebar-tutorial-section">
                        <p className="text-app-muted text-xs font-medium">{t('settings.tutorial')}</p>
                        <button
                            type="button"
                            onClick={resetTour}
                            className="w-full text-left px-2 py-1 text-xs border border-gray-700 rounded text-app-muted hover:bg-gray-700 cursor-pointer transition-colors"
                            data-testid="sidebar-restart-tutorial-button"
                        >
                            {t('settings.restartTutorial')}
                        </button>
                    </div>

                    {/* Keyboard shortcuts */}
                    <div className="space-y-1" data-testid="sidebar-keyboard-shortcuts-section">
                        <p className="text-app-muted text-xs font-medium">{t('settings.keyboardShortcuts')}</p>
                        <dl className="space-y-0.5 text-xs" data-testid="sidebar-keyboard-shortcuts-list">
                            {KEYBOARD_SHORTCUTS.map((shortcut) => (
                                <div key={shortcut.id} className="flex justify-between">
                                    <dt className="text-app-muted opacity-70">{shortcut.displayName}</dt>
                                    <dd className="text-app-muted font-mono text-xs">
                                        {getShortcutDisplay(isMac, shortcut)}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </div>
            )}
        </div>
    );
}
