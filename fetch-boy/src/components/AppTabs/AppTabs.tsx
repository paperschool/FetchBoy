import { type ReactNode } from "react";
import { useAppTabStore } from "@/stores/appTabStore";
import { InterceptView } from "@/components/Intercept/InterceptView";
import { useInterceptEvents } from "@/hooks/useInterceptEvents";

type AppTab = "fetch" | "intercept";

const TAB_LABELS: Record<AppTab, string> = {
  fetch: "Fetch",
  intercept: "Intercept",
};

interface AppTabsProps {
  children: ReactNode;
}

export function AppTabs({ children }: AppTabsProps) {
  const activeTab = useAppTabStore((s) => s.activeTab);
  const setActiveTab = useAppTabStore((s) => s.setActiveTab);

  useInterceptEvents();

  return (
    <div className="flex h-screen flex-col">
      {/* Top-level navigation tab bar */}
      <div
        className="flex shrink-0 border-b border-app-subtle bg-app-main px-2"
        role="tablist"
        aria-label="Application tabs"
      >
        {(Object.keys(TAB_LABELS) as AppTab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "-mb-px border-b-2 border-blue-500 text-app-primary"
                : "text-app-muted hover:text-app-secondary"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
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

        {/* Intercept panel: placeholder ready for Story 9.2 */}
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
