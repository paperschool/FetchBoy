import { GeneralSettings } from './GeneralSettings'
import { KeyboardShortcutsCard } from './KeyboardShortcutsCard'
import { FetchSettings } from './FetchSettings'
import { InterceptSettings } from './InterceptSettings'

export function SettingsView(): React.ReactElement {
    return (
        <div className="flex flex-col h-full bg-app-main overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl p-6">
                {/* Top section: General — full width */}
                <h3 className="text-app-muted text-xs font-medium uppercase tracking-wide mb-4">General</h3>
                <div className="flex gap-6">
                    <div className="flex-1 min-w-0">
                        <GeneralSettings />
                    </div>
                    {/* Vertical divider — padded from top/bottom */}
                    <div className="flex items-stretch py-2">
                        <div className="w-px bg-app-subtle" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <KeyboardShortcutsCard />
                    </div>
                </div>

                {/* Horizontal divider — padded from left/right */}
                <div className="px-4 my-6">
                    <div className="h-px bg-app-subtle" />
                </div>

                {/* Bottom section: Fetch + Intercept — full width */}
                <div className="flex gap-6">
                    <div className="flex-1 min-w-0">
                        <FetchSettings />
                    </div>
                    {/* Vertical divider — padded from top/bottom */}
                    <div className="flex items-stretch py-2">
                        <div className="w-px bg-app-subtle" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <InterceptSettings />
                    </div>
                </div>
            </div>
        </div>
    )
}
