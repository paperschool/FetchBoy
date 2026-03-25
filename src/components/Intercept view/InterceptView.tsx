import { useCallback, useEffect } from "react";
import { InterceptSidebar } from "./InterceptSidebar";
import { InterceptTable } from "./InterceptTable";
import { RequestDetailView } from "./RequestDetailView";
import { PausedRequestDetail } from "./PausedRequestDetail";
import { CertInstallPrompt } from "./CertInstallPrompt";
import { BreakpointEditor } from "@/components/Breakpoints/BreakpointEditor";
import { MappingEditor } from "@/components/Mappings/MappingEditor";
import { TabLayout } from "@/components/Layout/TabLayout";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useInterceptStore } from "@/stores/interceptStore";
import { useBreakpointsStore } from "@/stores/breakpointsStore";
import { useMappingsStore } from "@/stores/mappingsStore";
import { useInterceptEvents } from "@/hooks/useInterceptEvents";
import { useSplitPane } from "@/hooks/useSplitPane";
import { saveSetting } from "@/lib/settings";

export function InterceptView() {
  // Hook to listen for intercepted requests from the backend
  useInterceptEvents();

  const selectedRequest = useInterceptStore((state) =>
    state.requests.find((r) => r.id === state.selectedRequestId) ?? null
  );
  const pauseState = useInterceptStore((s) => s.pauseState);
  const editMode = useInterceptStore((s) => s.editMode);
  const pendingMods = useInterceptStore((s) => s.pendingMods);
  const updatePendingMods = useInterceptStore((s) => s.updatePendingMods);

  const { isEditing: isBpEditing, cancelEditing: cancelBpEditing } = useBreakpointsStore();
  const { isEditing: isMappingEditing, cancelEditing: cancelMappingEditing } = useMappingsStore();
  const selectedRequestId = useInterceptStore((s) => s.selectedRequestId);

  // Selecting a request dismisses editors
  useEffect(() => {
    if (selectedRequestId !== null) {
      cancelBpEditing();
      cancelMappingEditing();
    }
  }, [selectedRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isBpEditing ? (
          <BreakpointEditor onClose={cancelBpEditing} />
        ) : isMappingEditing ? (
          <MappingEditor onClose={cancelMappingEditing} />
        ) : (
          <div className={`flex-1 min-h-0 flex flex-col p-2 overflow-y-auto ${pauseState !== 'idle' ? 'ring-1 ring-amber-500/40 bg-amber-900/10 rounded-lg' : ''}`}>
            {pauseState !== 'idle' && <PausedRequestDetail />}
            <RequestDetailView
              selectedRequest={selectedRequest}
              editMode={editMode}
              pendingMods={pendingMods}
              onModsChange={updatePendingMods}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <CertInstallPrompt />
      <TabLayout
        sidebar={
          <InterceptSidebar
            collapsed={sidebarCollapsed}
            onToggle={handleToggleSidebar}
          />
        }
        mainContent={mainContent}
        sidebarCollapsed={sidebarCollapsed}
      />
    </>
  );
}
