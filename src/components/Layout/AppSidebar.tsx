import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  className?: string;
  showPanelButtons?: boolean;
  onCollectionsClick?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  activePanel?: 'collections' | 'history';
}

/**
 * Abstract sidebar component that provides common layout for both
 * FetchView and InterceptView sidebars.
 */
export function AppSidebar({
  collapsed,
  onToggle,
  children,
  className,
  showPanelButtons = false,
  onCollectionsClick,
  onHistoryClick,
  onSettingsClick,
  activePanel = 'collections',
}: AppSidebarProps) {
  if (collapsed) {
    return (
      <aside
        data-testid="sidebar"
        className={`bg-app-sidebar text-app-inverse overflow-hidden p-2 flex flex-col items-center gap-2 ${className ?? ''}`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="p-2 hover:bg-gray-700 rounded transition-colors"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <ChevronRight size={20} className="text-app-muted" />
        </button>
        
        {showPanelButtons && (
          <>
            <button
              type="button"
              onClick={onCollectionsClick}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              aria-label="Collections"
              title="Collections"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-app-muted"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onHistoryClick}
              className="p-2 hover:bg-gray-700 rounded transition-colors"
              aria-label="History"
              title="History"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-app-muted"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </button>
          </>
        )}
        
        <div className="flex-1" />
        
        {onSettingsClick && (
          <button
            type="button"
            onClick={onSettingsClick}
            className="p-2 hover:bg-gray-700 rounded transition-colors mt-auto"
            aria-label="Settings"
            title="Settings"
            data-testid="collapsed-settings-button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-app-muted"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        )}
      </aside>
    );
  }

  return (
    <aside
      data-testid="sidebar"
      className={`bg-app-sidebar text-app-inverse overflow-hidden p-3 flex flex-col ${className ?? ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-700 rounded transition-colors"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronLeft size={18} className="text-app-muted" />
        </button>
      </div>
      
      {showPanelButtons && (
        <div className="flex shrink-0 mb-3 rounded overflow-hidden border border-gray-700">
          <button
            type="button"
            onClick={onCollectionsClick}
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
            onClick={onHistoryClick}
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
      )}
      
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
    </aside>
  );
}
