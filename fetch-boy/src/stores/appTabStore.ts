import { create } from 'zustand'

type AppTab = 'client' | 'intercept'

interface AppTabStore {
  activeTab: AppTab
  setActiveTab: (tab: AppTab) => void
}

export const useAppTabStore = create<AppTabStore>((set) => ({
  activeTab: 'client',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
