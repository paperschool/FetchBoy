import { type ReactNode } from "react";
import type React from "react";
import { Send, Wifi } from "lucide-react";
import { useAppTabStore } from "@/stores/appTabStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { InterceptView } from "@/components/Intercept view/InterceptView";
import { FetchTabActions } from "@/components/TopBar/TopBar";
import { InterceptTabActions } from "@/components/Intercept view/InterceptTopBar";

type AppTab = "fetch" | "intercept";

const TAB_CONFIG: Record<AppTab, { label: string; icon: React.ReactNode }> = {
  fetch: { label: "Fetch", icon: <Send size={13} /> },
  intercept: { label: "Intercept", icon: <Wifi size={13} /> },
};

interface AppTabsProps {
  children: ReactNode;
}

export function AppTabs({ children }: AppTabsProps) {
  const activeTab = useAppTabStore((s) => s.activeTab);
  const setActiveTab = useAppTabStore((s) => s.setActiveTab);
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);

  return (
    <div className="flex h-screen flex-col">
      {/* Top-level navigation tab bar */}
      <div
        className="flex shrink-0 items-center border-b border-app-subtle bg-app-main px-2"
        role="tablist"
        aria-label="Application tabs"
      >
        <div className="flex flex-1">
          {(Object.keys(TAB_CONFIG) as AppTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              data-tour={tab === "intercept" ? "intercept-tab" : undefined}
              className={`group flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "-mb-px border-b-2 border-blue-500 text-app-primary"
                  : "text-app-muted hover:text-app-secondary"
              }`}
            >
              {TAB_CONFIG[tab].icon}
              {TAB_CONFIG[tab].label}
              {tab === "intercept" && (
                <span
                  className={`h-2 w-2 rounded-full transition-colors ${
                    proxyEnabled ? "bg-green-500" : "bg-gray-500"
                  }`}
                  title={proxyEnabled ? "Intercepting" : "Not intercepting"}
                />
              )}
            </button>
          ))}
        </div>

        {/* Tab-specific actions on the right */}
        <div className="flex items-center pr-1">
          {activeTab === "fetch" && <FetchTabActions />}
          {activeTab === "intercept" && <InterceptTabActions />}
        </div>
      </div>

      {/* Panel content — visibility toggled, NOT unmounted */}
      <div className="min-h-0 flex-1">
        {/* Fetch panel: keep mounted to preserve AppShell/TourController effects */}
        <div
          className={activeTab === "fetch" ? "h-full" : "hidden"}
          data-testid="fetch-panel"
        >
          {children}
        </div>

        {/* Intercept panel */}
        <div
          className={activeTab === "intercept" ? "h-full" : "hidden"}
          data-testid="intercept-panel"
        >
          <InterceptView />
        </div>
      </div>
    </div>
  );
}
