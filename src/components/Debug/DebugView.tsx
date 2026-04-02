import { FolderOpen } from 'lucide-react'
import { useDebugEvents } from '@/hooks/useDebugEvents'
import { useSystemOperations } from '@/hooks/useSystemOperations'
import { InternalEventTable } from './InternalEventTable'
import { TrafficTable } from './TrafficTable'
import { ProxyFlowDiagram } from './ProxyFlowDiagram'

export function DebugView() {
    useDebugEvents()
    const { openLogFolder } = useSystemOperations()

    return (
        <div className="flex flex-col h-full bg-app-main">
            <div className="flex items-center justify-end px-2 py-1 border-b border-app-subtle shrink-0">
                <button
                    onClick={openLogFolder}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors"
                    title="Open log files directory"
                >
                    <FolderOpen size={12} /> Open Log Folder
                </button>
            </div>
            <div className="flex flex-col flex-1 min-h-0">
                {/* Internal events — top pane */}
                <div className="flex-1 min-h-0 border-b border-app-subtle">
                    <InternalEventTable />
                </div>
                {/* Traffic — bottom pane */}
                <div className="flex-1 min-h-0">
                    <TrafficTable />
                </div>
            </div>
            <ProxyFlowDiagram />
        </div>
    )
}
