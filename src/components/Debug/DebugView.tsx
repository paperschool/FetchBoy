import { useDebugEvents } from '@/hooks/useDebugEvents'
import { InternalEventTable } from './InternalEventTable'
import { TrafficTable } from './TrafficTable'

export function DebugView() {
    useDebugEvents()

    return (
        <div className="flex flex-col h-full bg-app-main">
            <div className="flex flex-1 min-h-0">
                {/* Internal events — left pane */}
                <div className="flex-1 min-w-0 border-r border-app-subtle">
                    <InternalEventTable />
                </div>
                {/* Traffic — right pane */}
                <div className="flex-1 min-w-0">
                    <TrafficTable />
                </div>
            </div>
        </div>
    )
}
