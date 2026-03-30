import { useState } from 'react'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { useTourStore } from '@/stores/tourStore'
import { saveSetting } from '@/lib/settings'
import { getDb } from '@/lib/db'
import { open } from '@tauri-apps/plugin-shell'

export function GeneralSettings(): React.ReactElement {
    const theme = useUiSettingsStore((s) => s.theme)
    const setTheme = useUiSettingsStore((s) => s.setTheme)
    const editorFontSize = useUiSettingsStore((s) => s.editorFontSize)
    const setEditorFontSize = useUiSettingsStore((s) => s.setEditorFontSize)
    const resetTour = useTourStore((s) => s.resetTour)
    const [confirmingReset, setConfirmingReset] = useState(false)

    function handleThemeChange(value: 'light' | 'dark' | 'system'): void {
        setTheme(value)
        void saveSetting('theme', value)
    }

    function handleFontSizeDecrease(): void {
        const next = Math.max(10, editorFontSize - 1)
        if (next === editorFontSize) return
        setEditorFontSize(next)
        void saveSetting('editor_font_size', next)
    }

    function handleFontSizeIncrease(): void {
        const next = Math.min(24, editorFontSize + 1)
        if (next === editorFontSize) return
        setEditorFontSize(next)
        void saveSetting('editor_font_size', next)
    }

    async function handleDeleteAllData(): Promise<void> {
        const db = await getDb()
        const tables = ['requests', 'folders', 'collections', 'environments', 'history', 'breakpoints', 'breakpoint_folders', 'mappings', 'mapping_folders', 'settings']
        for (const table of tables) {
            await db.execute(`DELETE FROM ${table}`)
        }
        window.location.reload()
    }

    function handleCheckForUpdates(): void {
        void open('https://github.com/paperschool/FetchBoy/releases')
    }

    return (
        <div className="space-y-4">
            {/* Theme */}
            <div className="space-y-1">
                <p className="text-app-muted text-xs font-medium">Theme</p>
                <div className="flex gap-3 flex-wrap">
                    {(['light', 'dark', 'system'] as const).map((option) => (
                        <label key={option} className="flex items-center gap-1 text-app-muted text-xs cursor-pointer">
                            <input
                                type="radio"
                                name="settings-theme"
                                value={option}
                                checked={theme === option}
                                onChange={() => handleThemeChange(option)}
                            />
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                        </label>
                    ))}
                </div>
            </div>

            {/* Editor Font Size */}
            <div className="space-y-1">
                <p className="text-app-muted text-xs font-medium">Editor Font Size</p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        aria-label="Decrease font size"
                        onClick={handleFontSizeDecrease}
                        className="text-app-muted border border-gray-700 rounded w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs"
                    >
                        −
                    </button>
                    <span className="text-app-muted text-xs w-5 text-center">{editorFontSize}</span>
                    <button
                        type="button"
                        aria-label="Increase font size"
                        onClick={handleFontSizeIncrease}
                        className="text-app-muted border border-gray-700 rounded w-6 h-6 flex items-center justify-center hover:bg-black/10 text-xs"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* Delete All Data */}
            <div className="space-y-1">
                {!confirmingReset ? (
                    <button
                        type="button"
                        onClick={() => setConfirmingReset(true)}
                        className="w-full text-left px-2 py-1 text-xs border border-gray-700 rounded text-red-400 hover:bg-gray-700 cursor-pointer transition-colors"
                    >
                        Delete All Data &amp; Reset Settings
                    </button>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">Are you sure?</span>
                        <button
                            type="button"
                            onClick={() => void handleDeleteAllData()}
                            className="px-2 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500 cursor-pointer transition-colors"
                        >
                            Yes, delete
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirmingReset(false)}
                            className="px-2 py-1 text-xs border border-gray-700 rounded text-app-muted hover:bg-gray-700 cursor-pointer transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Restart Tutorial */}
            <button
                type="button"
                onClick={resetTour}
                className="w-full text-left px-2 py-1 text-xs border border-gray-700 rounded text-app-muted hover:bg-gray-700 cursor-pointer transition-colors"
            >
                Restart Tutorial
            </button>

            {/* Check for Updates */}
            <button
                type="button"
                onClick={handleCheckForUpdates}
                className="w-full text-left px-2 py-1 text-xs border border-gray-700 rounded text-app-muted hover:bg-gray-700 cursor-pointer transition-colors"
            >
                Check for Updates
            </button>
        </div>
    )
}
