import { useCallback } from "react";
import { Shield } from "lucide-react";
import { InterceptSidebar } from "./InterceptSidebar";
import { InterceptTopBar } from "./InterceptTopBar";
import { InterceptTable } from "./InterceptTable";
import { TabLayout } from "@/components/Layout/TabLayout";
import { useInterceptStore } from "@/stores/interceptStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { saveSetting } from "@/lib/settings";

export function InterceptView() {
  const requests = useInterceptStore((state) => state.requests);
  const sidebarCollapsed = useUiSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiSettingsStore((s) => s.setSidebarCollapsed);

  const handleToggleSidebar = useCallback(() => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    saveSetting("sidebar_collapsed", newState).catch(() => {});
  }, [sidebarCollapsed, setSidebarCollapsed]);

  const middleContent = (
    <div className="flex flex-col min-h-0 h-full">
      {requests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-app-main">
          <Shield className="h-12 w-12 text-app-muted" />
          <h2 className="text-base font-semibold text-app-primary">
            Traffic Intercept
          </h2>
          <p className="text-sm text-app-muted">
            Start the proxy to see requests here.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden bg-app-main">
          <InterceptTable />
        </div>
      )}
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
      // middleContent={middleContent}
      mainContent={middleContent}
      sidebarCollapsed={sidebarCollapsed}
    />
  );
}
