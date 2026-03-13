import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Breakpoint, BreakpointFolder } from '@/lib/db';

interface BreakpointsState {
    folders: BreakpointFolder[];
    breakpoints: Breakpoint[];

    loadAll: (folders: BreakpointFolder[], breakpoints: Breakpoint[]) => void;

    // Folder actions
    addFolder: (folder: BreakpointFolder) => void;
    renameFolder: (id: string, name: string) => void;
    deleteFolder: (id: string) => void;

    // Breakpoint actions
    addBreakpoint: (breakpoint: Breakpoint) => void;
    updateBreakpoint: (id: string, changes: Partial<Pick<Breakpoint, 'name' | 'url_pattern' | 'match_type' | 'enabled'>>) => void;
    deleteBreakpoint: (id: string) => void;
}

export const useBreakpointsStore = create<BreakpointsState>()(
    immer((set) => ({
        folders: [],
        breakpoints: [],

        loadAll: (folders, breakpoints) =>
            set((state) => {
                state.folders = folders;
                state.breakpoints = breakpoints;
            }),

        addFolder: (folder) =>
            set((state) => {
                state.folders.push(folder);
            }),

        renameFolder: (id, name) =>
            set((state) => {
                const folder = state.folders.find((f) => f.id === id);
                if (folder) folder.name = name;
            }),

        deleteFolder: (id) =>
            set((state) => {
                state.folders = state.folders.filter((f) => f.id !== id);
                state.breakpoints = state.breakpoints.filter((bp) => bp.folder_id !== id);
            }),

        addBreakpoint: (breakpoint) =>
            set((state) => {
                state.breakpoints.push(breakpoint);
            }),

        updateBreakpoint: (id, changes) =>
            set((state) => {
                const bp = state.breakpoints.find((b) => b.id === id);
                if (bp) Object.assign(bp, changes);
            }),

        deleteBreakpoint: (id) =>
            set((state) => {
                state.breakpoints = state.breakpoints.filter((bp) => bp.id !== id);
            }),
    })),
);
