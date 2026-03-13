import { useCallback } from "react";
import { InterceptSidebar } from "./InterceptSidebar";
import { InterceptTopBar } from "./InterceptTopBar";
import { InterceptTable } from "./InterceptTable";
import { RequestDetailView } from "./RequestDetailView";
import { TabLayout } from "@/components/Layout/TabLayout";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useInterceptStore } from "@/stores/interceptStore";
import { useInterceptEvents } from "@/hooks/useInterceptEvents";
import { useSplitPane } from "@/hooks/useSplitPane";
import { saveSetting } from "@/lib/settings";

export function InterceptView() {
  // Hook to listen for intercepted requests from the backend
  useInterceptEvents();

  const selectedRequest = useInterceptStore((state) =>
    state.requests.find((r) => r.id === state.selectedRequestId) ?? null
  );

  const sidebarCollapsed = useUiSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiSettingsStore((s) => s.setSidebarCollapsed);
  const { containerRef, topPercent, onDividerMouseDown } = useSplitPane(60, 120);

  const handleToggleSidebar = useCallback(() => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    saveSetting("sidebar_collapsed", newState).catch(() => {});
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const mainContent = (
    <div ref={containerRef} className="h-full bg-app-main flex flex-col min-h-0">
      <div style={{ height: `${topPercent}%` }} className="min-h-0 overflow-hidden shrink-0">
        <InterceptTable />
      </div>
      <div
        className="h-1 bg-app-subtle hover:bg-blue-500/40 cursor-row-resize shrink-0 transition-colors"
        onMouseDown={onDividerMouseDown}
        role="separator"
        aria-orientation="horizontal"
      />
      <div className="flex-1 min-h-0 flex flex-col">
        <RequestDetailView selectedRequest={selectedRequest} />
      </div>
    </div>
  );

  return (
    <TabLayout
      topBar={<InterceptTopBar />}
      sidebar={
        <InterceptSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />
      }
      mainContent={mainContent}
      sidebarCollapsed={sidebarCollapsed}
    />
  );
}
