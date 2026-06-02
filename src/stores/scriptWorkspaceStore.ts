import { create } from 'zustand';

export type ScriptSlot = 'global' | 'pre' | 'post';

interface ScriptWorkspaceStore {
  /** Slot the Script Workspace should open to next (consumed once on mount). */
  pendingMode: ScriptSlot | null;
  setPendingMode: (mode: ScriptSlot | null) => void;
}

/** Lets the Fetch Scripts launchers deep-link the workspace to a specific slot. */
export const useScriptWorkspaceStore = create<ScriptWorkspaceStore>((set) => ({
  pendingMode: null,
  setPendingMode: (mode) => set({ pendingMode: mode }),
}));
