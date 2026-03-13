import { useCallback } from "react";
import { InterceptSidebar } from "./InterceptSidebar";
import { InterceptTopBar } from "./InterceptTopBar";
import { InterceptTable } from "./InterceptTable";
import { TabLayout } from "@/components/Layout/TabLayout";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useInterceptEvents } from "@/hooks/useInterceptEvents";
import { saveSetting } from "@/lib/settings";

export function InterceptView() {
  // Hook to listen for intercepted requests from the backend
  useInterceptEvents();
  
  const sidebarCollapsed = useUiSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiSettingsStore((s) => s.setSidebarCollapsed);

  const handleToggleSidebar = useCallback(() => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    saveSetting("sidebar_collapsed", newState).catch(() => {});
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const mainContent = (
    <div className="h-full bg-app-main flex flex-col min-h-0">
      <InterceptTable />
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
