import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { addWithMaxSize } from '@/lib/arrayHelpers';
import { MAX_DEBUG_ENTRIES } from '@/lib/constants';

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
            set((state) => { addWithMaxSize(state.internalEvents, event, MAX_DEBUG_ENTRIES); }),
        addTrafficEvent: (event) =>
            set((state) => { addWithMaxSize(state.trafficEvents, event, MAX_DEBUG_ENTRIES); }),
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
