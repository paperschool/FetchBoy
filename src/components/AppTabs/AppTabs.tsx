import { type ReactNode } from "react";
import type React from "react";
import { Send, Wifi, Link2, Bug, Settings } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useAppTabStore } from "@/stores/appTabStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { InterceptView } from "@/components/InterceptView/InterceptView";
import { DebugView } from "@/components/Debug/DebugView";
import { SettingsView } from "@/components/SettingsView/SettingsView";
import { FetchTabActions } from "@/components/TopBar/TopBar";
import { InterceptTabActions } from "@/components/InterceptView/InterceptTopBar";
import { StitchView } from "@/components/StitchView/StitchView";
import { useChainExecutionListener } from "@/hooks/useChainExecutionListener";

type AppTab = "fetch" | "intercept" | "stitch" | "debug" | "settings";

const TAB_CONFIG: Record<AppTab, { label: string; icon: React.ReactNode }> = {
  fetch: { label: "Fetch", icon: <Send size={13} /> },
  intercept: { label: "Intercept", icon: <Wifi size={13} /> },
  stitch: { label: "Stitch", icon: <Link2 size={13} /> },
  debug: { label: "", icon: <Bug size={13} /> },
  settings: { label: "", icon: <Settings size={13} /> },
};

interface AppTabsProps {
  children: ReactNode;
}

export function AppTabs({ children }: AppTabsProps) {
  const activeTab = useAppTabStore((s) => s.activeTab);
  const setActiveTab = useAppTabStore((s) => s.setActiveTab);
  const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled);

  // Always-on listener for proxy-triggered chain execution (must be globally mounted)
  useChainExecutionListener();

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
          <ErrorBoundary fallbackLabel="Fetch">
            {children}
          </ErrorBoundary>
        </div>

        {/* Intercept panel */}
        <div
          className={activeTab === "intercept" ? "h-full" : "hidden"}
          data-testid="intercept-panel"
        >
          <ErrorBoundary fallbackLabel="Intercept">
            <InterceptView />
          </ErrorBoundary>
        </div>

        {/* Stitch panel */}
        <div
          className={activeTab === "stitch" ? "h-full" : "hidden"}
          data-testid="stitch-panel"
        >
          <ErrorBoundary fallbackLabel="Stitch">
            <StitchView />
          </ErrorBoundary>
        </div>

        {/* Debug panel */}
        <div
          className={activeTab === "debug" ? "h-full" : "hidden"}
          data-testid="debug-panel"
        >
          <ErrorBoundary fallbackLabel="Debug">
            <DebugView />
          </ErrorBoundary>
        </div>

        {/* Settings panel */}
        <div
          className={activeTab === "settings" ? "h-full" : "hidden"}
          data-testid="settings-panel"
        >
          <ErrorBoundary fallbackLabel="Settings">
            <SettingsView />
          </ErrorBoundary>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}
