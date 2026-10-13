import { useCallback, useEffect, useState } from "react";
import { InterceptSidebar } from "./InterceptSidebar";
import { InterceptTable } from "./InterceptTable";
import { MappingLogTable } from "./MappingLogTable";
import { IgnoreRulesTable } from "./IgnoreRulesTable";
import { IgnoreRuleEditor } from "./IgnoreRuleEditor";
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
import { useMappingLogStore } from "@/stores/mappingLogStore";
import { useIgnoreRulesStore } from "@/stores/ignoreRulesStore";
import { useInterceptEvents } from "@/hooks/useInterceptEvents";
import { useMappingLogEvents } from "@/hooks/useMappingLogEvents";
import { useSplitPane } from "@/hooks/useSplitPane";
import { saveSetting } from "@/lib/settings";
import { t } from "@/lib/i18n";

export function InterceptView() {
  // Hook to listen for intercepted requests and mapping events from the backend
  useInterceptEvents();
  useMappingLogEvents();

  const [topTab, setTopTab] = useState<'requests' | 'mapping-log' | 'ignore'>('requests');
  const mappingLogUnseenCount = useMappingLogStore((s) => s.unseenCount);
  const markMappingLogSeen = useMappingLogStore((s) => s.markSeen);

  // Keep the Overrides tab's badge at 0 while it's the active tab, including
  // for entries that arrive after it's already open.
  useEffect(() => {
    if (topTab === 'mapping-log') markMappingLogSeen();
  }, [topTab, mappingLogUnseenCount, markMappingLogSeen]);

  const selectedRequest = useInterceptStore((state) =>
    state.requests.find((r) => r.id === state.selectedRequestId) ?? null
  );
  const pauseState = useInterceptStore((s) => s.pauseState);
  const editMode = useInterceptStore((s) => s.editMode);
  const pendingMods = useInterceptStore((s) => s.pendingMods);
  const updatePendingMods = useInterceptStore((s) => s.updatePendingMods);

  const { isEditing: isBpEditing, cancelEditing: cancelBpEditing, editForm: bpEditForm } = useBreakpointsStore();
  const { isEditing: isMappingEditing, cancelEditing: cancelMappingEditing, editForm: mappingEditForm } = useMappingsStore();
  const { isEditing: isIgnoreEditing, cancelEditing: cancelIgnoreEditing, editForm: ignoreEditForm } = useIgnoreRulesStore();
  const selectedRequestId = useInterceptStore((s) => s.selectedRequestId);

  // Selecting a request dismisses editors
  useEffect(() => {
    if (selectedRequestId !== null) {
      cancelBpEditing();
      cancelMappingEditing();
      cancelIgnoreEditing();
    }
  }, [selectedRequestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving the Ignore sub-tab dismisses the ignore editor.
  useEffect(() => {
    if (topTab !== 'ignore') cancelIgnoreEditing();
  }, [topTab]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* Sub-tab switcher: Requests / Overrides / Ignore */}
      <div className="flex border-b border-app-subtle shrink-0 bg-app-main">
        {(['requests', 'mapping-log', 'ignore'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setTopTab(tab)}
            data-tour={tab === 'mapping-log' ? 'overrides-tab' : tab === 'ignore' ? 'ignore-tab' : undefined}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs transition-colors ${
              topTab === tab
                ? 'text-app-inverse font-medium border-b-2 border-app-accent'
                : 'text-app-muted hover:text-app-inverse'
            }`}>
            {tab === 'requests' ? t('intercept.requests') : tab === 'mapping-log' ? t('intercept.overrides') : t('intercept.ignore')}
            {tab === 'mapping-log' && mappingLogUnseenCount > 0 && (
              <span
                className="flex min-w-[1.1rem] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium leading-none text-white"
                data-testid="mapping-log-tab-badge"
                title={`${mappingLogUnseenCount} new override${mappingLogUnseenCount !== 1 ? 's' : ''}`}
              >
                {mappingLogUnseenCount > 99 ? '99+' : mappingLogUnseenCount}
              </span>
            )}
          </button>
        ))}
      </div>
      <div style={{ height: `${topPercent}%` }} className="min-h-0 overflow-hidden shrink-0">
        {topTab === 'requests' ? <InterceptTable /> : topTab === 'mapping-log' ? <MappingLogTable /> : <IgnoreRulesTable />}
      </div>
      <div
        className="h-1 bg-app-subtle hover:bg-blue-500/40 cursor-row-resize shrink-0 transition-colors"
        onMouseDown={onDividerMouseDown}
        role="separator"
        aria-orientation="horizontal"
      />
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {isIgnoreEditing ? (
          <IgnoreRuleEditor key={ignoreEditForm.id ?? 'new-ignore'} onClose={cancelIgnoreEditing} />
        ) : isBpEditing ? (
          <BreakpointEditor key={bpEditForm.id ?? 'new-bp'} onClose={cancelBpEditing} />
        ) : isMappingEditing ? (
          <MappingEditor key={mappingEditForm.id ?? 'new-mapping'} onClose={cancelMappingEditing} />
        ) : (
          <div className={`flex-1 min-h-0 flex flex-col p-2 overflow-y-auto ${pauseState !== 'idle' ? 'ring-1 ring-amber-500/40 bg-amber-900/10 rounded overflow-hidden' : ''}`}>
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
