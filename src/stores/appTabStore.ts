import { create } from "zustand";

type AppTab = "fetch" | "intercept" | "stitch" | "debug" | "settings";

interface AppTabStore {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

export const useAppTabStore = create<AppTabStore>((set) => ({
  activeTab: "fetch",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
