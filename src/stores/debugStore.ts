import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface DebugInternalEvent {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    source: string;
    message: string;
}

export interface DebugTrafficEvent {
    id: string;
    timestamp: number;
    method: string;
    url: string;
    status: number | null;
    durationMs: number | null;
}

const MAX_ENTRIES = 1000;

interface DebugStore {
    internalEvents: DebugInternalEvent[];
    trafficEvents: DebugTrafficEvent[];
    addInternalEvent: (event: DebugInternalEvent) => void;
    addTrafficEvent: (event: DebugTrafficEvent) => void;
    updateTrafficEvent: (id: string, status: number, durationMs: number) => void;
    clearInternal: () => void;
    clearTraffic: () => void;
}

export const useDebugStore = create<DebugStore>()(
    immer((set) => ({
        internalEvents: [],
        trafficEvents: [],
        addInternalEvent: (event) =>
            set((state) => {
                state.internalEvents.push(event);
                if (state.internalEvents.length > MAX_ENTRIES) {
                    state.internalEvents.splice(0, state.internalEvents.length - MAX_ENTRIES);
                }
            }),
        addTrafficEvent: (event) =>
            set((state) => {
                state.trafficEvents.push(event);
                if (state.trafficEvents.length > MAX_ENTRIES) {
                    state.trafficEvents.splice(0, state.trafficEvents.length - MAX_ENTRIES);
                }
            }),
        updateTrafficEvent: (id, status, durationMs) =>
            set((state) => {
                const event = state.trafficEvents.find((e) => e.id === id);
                if (event) {
                    event.status = status;
                    event.durationMs = durationMs;
                }
            }),
        clearInternal: () => set((state) => { state.internalEvents = []; }),
        clearTraffic: () => set((state) => { state.trafficEvents = []; }),
    }))
);
