import { KEYBOARD_SHORTCUTS, getShortcutDisplay } from '@/lib/keyboardShortcuts'

export function KeyboardShortcutsCard(): React.ReactElement {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC')

    return (
        <div className="space-y-4">
            <p className="text-app-muted text-xs font-medium">Keyboard Shortcuts</p>
            <dl className="space-y-1 text-xs">
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
    )
}
