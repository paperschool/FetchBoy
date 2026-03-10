import { useState } from 'react';
import { CollectionTree } from '@/components/CollectionTree/CollectionTree';
import { HistoryPanel } from '@/components/HistoryPanel/HistoryPanel';

type SidebarPanel = 'collections' | 'history';

export function Sidebar() {
    const [activePanel, setActivePanel] = useState<SidebarPanel>('collections');

    return (
        <aside
            data-testid="sidebar"
            className="bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col"
        >
            <div className="flex shrink-0 mb-3 rounded overflow-hidden border border-gray-700">
                <button
                    type="button"
                    onClick={() => setActivePanel('collections')}
                    className={`flex-1 py-1.5 text-xs cursor-pointer ${
                        activePanel === 'collections'
                            ? 'bg-gray-700 text-app-inverse font-medium'
                            : 'text-app-muted hover:text-app-inverse'
                    }`}
                    aria-label="Collections panel"
                >
                    Collections
                </button>
                <button
                    type="button"
                    onClick={() => setActivePanel('history')}
                    className={`flex-1 py-1.5 text-xs cursor-pointer ${
                        activePanel === 'history'
                            ? 'bg-gray-700 text-app-inverse font-medium'
                            : 'text-app-muted hover:text-app-inverse'
                    }`}
                    aria-label="History panel"
                >
                    History
                </button>
            </div>

            {activePanel === 'collections' ? <CollectionTree /> : <HistoryPanel />}
        </aside>
    );
}

