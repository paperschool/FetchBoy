import { useState } from 'react';
import { ChevronLeft, ChevronRight, Folder, Clock, Settings as SettingsIcon } from 'lucide-react';
import { CollectionTree } from '@/components/CollectionTree/CollectionTree';
import { HistoryPanel } from '@/components/HistoryPanel/HistoryPanel';
import { SettingsAccordion } from './SettingsAccordion';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { saveSetting } from '@/lib/settings';

type SidebarPanel = 'collections' | 'history';

interface SidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
    const [activePanel, setActivePanel] = useState<SidebarPanel>('collections');
    const sidebarSettingsExpanded = useUiSettingsStore((s) => s.sidebarSettingsExpanded);
    const setSidebarSettingsExpanded = useUiSettingsStore((s) => s.setSidebarSettingsExpanded);

    function handleSettingsToggle() {
        const next = !sidebarSettingsExpanded;
        setSidebarSettingsExpanded(next);
        void saveSetting('sidebar_settings_expanded', next);
    }

    if (collapsed) {
        return (
            <aside
                data-testid="sidebar"
                className="bg-app-sidebar text-app-inverse overflow-hidden p-2 flex flex-col items-center gap-2 h-full"
            >
                <button
                    type="button"
                    onClick={onToggle}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    aria-label="Expand sidebar"
                    title="Expand sidebar (Cmd/Ctrl+B)"
                >
                    <ChevronRight size={20} className="text-app-muted" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setActivePanel('collections');
                        onToggle();
                    }}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    aria-label="Collections"
                    title="Collections"
                >
                    <Folder size={20} className="text-app-muted" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setActivePanel('history');
                        onToggle();
                    }}
                    className="p-2 hover:bg-gray-700 rounded transition-colors"
                    aria-label="History"
                    title="History"
                >
                    <Clock size={20} className="text-app-muted" />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setSidebarSettingsExpanded(true);
                        void saveSetting('sidebar_settings_expanded', true);
                        onToggle();
                    }}
                    className="p-2 hover:bg-gray-700 rounded transition-colors mt-auto"
                    aria-label="Settings"
                    title="Settings"
                    data-testid="collapsed-settings-button"
                >
                    <SettingsIcon size={20} className="text-app-muted" />
                </button>
            </aside>
        );
    }

    return (
        <aside
            data-testid="sidebar"
            className="bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col h-full"
        >
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={onToggle}
                    className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar (Cmd/Ctrl+B)"
                >
                    <ChevronLeft size={18} className="text-app-muted" />
                </button>
            </div>
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

            <div className="flex-1 min-h-0 overflow-y-auto" data-tour="collections-sidebar">
                {activePanel === 'collections' && <CollectionTree />}
                {activePanel === 'history' && <HistoryPanel />}
            </div>

            <div data-tour="settings-env">
                <SettingsAccordion isExpanded={sidebarSettingsExpanded} onToggle={handleSettingsToggle} />
            </div>
        </aside>
    );
}
