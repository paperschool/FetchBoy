import { describe, it, expect, beforeEach } from 'vitest';
import { useDebugStore } from './debugStore';
import type { DebugInternalEvent, DebugTrafficEvent } from './debugStore';

function makeInternalEvent(overrides: Partial<DebugInternalEvent> = {}): DebugInternalEvent {
    return {
        id: `int-${Math.random()}`,
        timestamp: Date.now(),
        level: 'info',
        source: 'proxy',
        message: 'test event',
        ...overrides,
    };
}

function makeTrafficEvent(overrides: Partial<DebugTrafficEvent> = {}): DebugTrafficEvent {
    return {
        id: `trf-${Math.random()}`,
        timestamp: Date.now(),
        method: 'GET',
        url: 'example.com/api',
        status: null,
        durationMs: null,
        ...overrides,
    };
}

beforeEach(() => {
    useDebugStore.setState({ internalEvents: [], trafficEvents: [] });
});

describe('debugStore', () => {
    it('adds internal events', () => {
        const event = makeInternalEvent();
        useDebugStore.getState().addInternalEvent(event);
        expect(useDebugStore.getState().internalEvents).toHaveLength(1);
        expect(useDebugStore.getState().internalEvents[0].message).toBe('test event');
    });

    it('adds traffic events', () => {
        const event = makeTrafficEvent();
        useDebugStore.getState().addTrafficEvent(event);
        expect(useDebugStore.getState().trafficEvents).toHaveLength(1);
        expect(useDebugStore.getState().trafficEvents[0].method).toBe('GET');
    });

    it('updates traffic event with status and duration', () => {
        const event = makeTrafficEvent({ id: 'req-1' });
        useDebugStore.getState().addTrafficEvent(event);
        useDebugStore.getState().updateTrafficEvent('req-1', 200, 42);
        const updated = useDebugStore.getState().trafficEvents[0];
        expect(updated.status).toBe(200);
        expect(updated.durationMs).toBe(42);
    });

    it('clears internal events', () => {
        useDebugStore.getState().addInternalEvent(makeInternalEvent());
        useDebugStore.getState().addInternalEvent(makeInternalEvent());
        useDebugStore.getState().clearInternal();
        expect(useDebugStore.getState().internalEvents).toHaveLength(0);
    });

    it('clears traffic events', () => {
        useDebugStore.getState().addTrafficEvent(makeTrafficEvent());
        useDebugStore.getState().clearTraffic();
        expect(useDebugStore.getState().trafficEvents).toHaveLength(0);
    });

    it('evicts oldest internal events when exceeding 1000', () => {
        for (let i = 0; i < 1005; i++) {
            useDebugStore.getState().addInternalEvent(makeInternalEvent({ id: `evt-${i}` }));
        }
        const events = useDebugStore.getState().internalEvents;
        expect(events.length).toBe(1000);
        expect(events[0].id).toBe('evt-5');
    });

    it('evicts oldest traffic events when exceeding 1000', () => {
        for (let i = 0; i < 1005; i++) {
            useDebugStore.getState().addTrafficEvent(makeTrafficEvent({ id: `trf-${i}` }));
        }
        const events = useDebugStore.getState().trafficEvents;
        expect(events.length).toBe(1000);
        expect(events[0].id).toBe('trf-5');
    });
});
