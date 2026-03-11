import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from './tabStore';

function makeTestTab(overrides: Partial<Parameters<typeof useTabStore.setState>[0]> = {}) {
    const id = crypto.randomUUID();
    return {
        id,
        label: 'New Request',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: createDefaultResponseSnapshot(),
        ...overrides,
    };
}

const getInitialState = () => {
    const firstTab = makeTestTab();
    return {
        tabs: [firstTab],
        activeTabId: firstTab.id,
    };
};

describe('tabStore', () => {
    beforeEach(() => {
        const firstTab = makeTestTab();
        useTabStore.setState({
            tabs: [firstTab],
            activeTabId: firstTab.id,
        });
    });

    it('initial state has exactly one tab with label "New Request" and isCustomLabel false', () => {
        const { tabs, activeTabId } = useTabStore.getState();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].label).toBe('New Request');
        expect(tabs[0].isCustomLabel).toBe(false);
        expect(activeTabId).toBe(tabs[0].id);
    });

    it('addTab() appends a new tab and makes it active', () => {
        const { addTab } = useTabStore.getState();
        addTab();
        const { tabs, activeTabId } = useTabStore.getState();
        expect(tabs).toHaveLength(2);
        expect(tabs[1].label).toBe('New Request');
        expect(tabs[1].isCustomLabel).toBe(false);
        expect(activeTabId).toBe(tabs[1].id);
    });

    it('closeTab(id) with two tabs removes the tab and activates the neighbour', () => {
        const { addTab } = useTabStore.getState();
        addTab();
        const { tabs: tabsAfterAdd } = useTabStore.getState();
        const firstId = tabsAfterAdd[0].id;
        const secondId = tabsAfterAdd[1].id;

        // Close the second (active) tab — should activate the first
        useTabStore.getState().closeTab(secondId);
        const { tabs, activeTabId } = useTabStore.getState();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].id).toBe(firstId);
        expect(activeTabId).toBe(firstId);
    });

    it('closeTab(id) with one tab does nothing (tab count stays at 1)', () => {
        const { tabs: initial } = useTabStore.getState();
        useTabStore.getState().closeTab(initial[0].id);
        const { tabs } = useTabStore.getState();
        expect(tabs).toHaveLength(1);
    });

    it('renameTab(id, "Foo") sets label to "Foo" and isCustomLabel to true', () => {
        const { tabs } = useTabStore.getState();
        useTabStore.getState().renameTab(tabs[0].id, 'Foo');
        const updated = useTabStore.getState().tabs[0];
        expect(updated.label).toBe('Foo');
        expect(updated.isCustomLabel).toBe(true);
    });

    it('syncLabelFromRequest does NOT update label when isCustomLabel is true', () => {
        const { tabs } = useTabStore.getState();
        const id = tabs[0].id;
        // First rename to set isCustomLabel = true
        useTabStore.getState().renameTab(id, 'My Custom Label');
        // Now try to sync
        useTabStore.getState().syncLabelFromRequest(id, 'POST', 'https://api.example.com/users');
        const updated = useTabStore.getState().tabs[0];
        expect(updated.label).toBe('My Custom Label');
    });

    it('syncLabelFromRequest DOES update label when isCustomLabel is false', () => {
        const { tabs } = useTabStore.getState();
        const id = tabs[0].id;
        useTabStore.getState().syncLabelFromRequest(id, 'GET', 'https://api.example.com');
        const updated = useTabStore.getState().tabs[0];
        expect(updated.label).toBe('GET https://api.example.com');
        expect(updated.isCustomLabel).toBe(false);
    });

    it('syncLabelFromRequest truncates a URL longer than 30 chars', () => {
        const { tabs } = useTabStore.getState();
        const id = tabs[0].id;
        useTabStore.getState().syncLabelFromRequest(id, 'GET', 'https://api.example.com/very/long/path/here');
        const updated = useTabStore.getState().tabs[0];
        expect(updated.label.length).toBeLessThanOrEqual(30);
        expect(updated.label.endsWith('…')).toBe(true);
    });

    it('syncLabelFromRequest keeps "New Request" when url is empty', () => {
        const { tabs } = useTabStore.getState();
        const id = tabs[0].id;
        useTabStore.getState().syncLabelFromRequest(id, 'GET', '');
        const updated = useTabStore.getState().tabs[0];
        expect(updated.label).toBe('New Request');
    });

    it('closeTab activates left neighbour when closing the active first tab with a right neighbour', () => {
        const { addTab } = useTabStore.getState();
        addTab();
        const { tabs: tabsAfterAdd, setActiveTab } = useTabStore.getState();
        const firstId = tabsAfterAdd[0].id;
        const secondId = tabsAfterAdd[1].id;

        // Make first tab active and close it
        setActiveTab(firstId);
        useTabStore.getState().closeTab(firstId);
        const { tabs, activeTabId } = useTabStore.getState();
        expect(tabs).toHaveLength(1);
        expect(activeTabId).toBe(secondId);
    });

    describe('per-tab state isolation', () => {
        it('addTab() creates new tab with default request state', () => {
            useTabStore.getState().addTab();
            const { tabs } = useTabStore.getState();
            const newTab = tabs[1];
            expect(newTab.requestState.method).toBe('GET');
            expect(newTab.requestState.url).toBe('');
            expect(newTab.requestState.isDirty).toBe(false);
            expect(newTab.responseState.isSending).toBe(false);
            expect(newTab.responseState.responseData).toBeNull();
        });

        it('updateTabRequestState modifies only the target tab', () => {
            useTabStore.getState().addTab();
            const { tabs } = useTabStore.getState();
            const [tab1, tab2] = tabs;

            useTabStore.getState().updateTabRequestState(tab1.id, { url: 'https://example.com' });

            const updated = useTabStore.getState().tabs;
            expect(updated[0].requestState.url).toBe('https://example.com');
            expect(updated[1].requestState.url).toBe('');
        });

        it('updateTabResponseState modifies only the target tab', () => {
            useTabStore.getState().addTab();
            const { tabs } = useTabStore.getState();
            const [tab1, tab2] = tabs;

            useTabStore.getState().updateTabResponseState(tab2.id, { requestError: 'timeout' });

            const updated = useTabStore.getState().tabs;
            expect(updated[1].responseState.requestError).toBe('timeout');
            expect(updated[0].responseState.requestError).toBeNull();
        });

        it('setActiveTab does not mutate either tab requestState', () => {
            useTabStore.getState().addTab();
            const { tabs } = useTabStore.getState();
            const [tab1, tab2] = tabs;

            useTabStore.getState().updateTabRequestState(tab1.id, { url: 'https://tab1.com', isDirty: true });
            useTabStore.getState().updateTabRequestState(tab2.id, { url: 'https://tab2.com' });

            // Switch to tab2
            useTabStore.getState().setActiveTab(tab2.id);

            const updated = useTabStore.getState().tabs;
            expect(updated[0].requestState.url).toBe('https://tab1.com');
            expect(updated[1].requestState.url).toBe('https://tab2.com');
        });

        it('appendResponseLog appends to the correct tab without affecting others', () => {
            useTabStore.getState().addTab();
            const { tabs } = useTabStore.getState();
            const [tab1, tab2] = tabs;

            useTabStore.getState().appendResponseLog(tab1.id, 'hello');

            const updated = useTabStore.getState().tabs;
            expect(updated[0].responseState.verboseLogs).toEqual(['hello']);
            expect(updated[1].responseState.verboseLogs).toEqual([]);
        });
    });

    describe('openRequestInNewTab', () => {
        it('creates a new tab with the given snapshot and label, isCustomLabel true', () => {
            const snapshot = { ...createDefaultRequestSnapshot(), url: 'https://api.example.com', method: 'POST' as const };
            const { tabs: before } = useTabStore.getState();
            expect(before).toHaveLength(1);

            useTabStore.getState().openRequestInNewTab(snapshot, 'My Request');

            const { tabs } = useTabStore.getState();
            expect(tabs).toHaveLength(2);
            const newTab = tabs[1];
            expect(newTab.label).toBe('My Request');
            expect(newTab.isCustomLabel).toBe(true);
            expect(newTab.requestState.url).toBe('https://api.example.com');
            expect(newTab.requestState.method).toBe('POST');
        });

        it('new tab gets a fresh responseState', () => {
            const snapshot = createDefaultRequestSnapshot();
            useTabStore.getState().openRequestInNewTab(snapshot, 'Fresh Tab');

            const { tabs } = useTabStore.getState();
            const newTab = tabs[1];
            expect(newTab.responseState.responseData).toBeNull();
            expect(newTab.responseState.requestError).toBeNull();
            expect(newTab.responseState.isSending).toBe(false);
            expect(newTab.responseState.verboseLogs).toEqual([]);
        });

        it('activeTabId points to the new tab after openRequestInNewTab', () => {
            const snapshot = createDefaultRequestSnapshot();
            useTabStore.getState().openRequestInNewTab(snapshot, 'Target Tab');

            const { tabs, activeTabId } = useTabStore.getState();
            expect(activeTabId).toBe(tabs[1].id);
        });

        it('original tab requestState is unchanged after openRequestInNewTab', () => {
            const { tabs: initial } = useTabStore.getState();
            const originalId = initial[0].id;
            useTabStore.getState().updateTabRequestState(originalId, { url: 'https://original.com', isDirty: true });

            const snapshot = { ...createDefaultRequestSnapshot(), url: 'https://new.com' };
            useTabStore.getState().openRequestInNewTab(snapshot, 'New Tab');

            const { tabs } = useTabStore.getState();
            expect(tabs[0].requestState.url).toBe('https://original.com');
            expect(tabs[0].requestState.isDirty).toBe(true);
        });
    });

    describe('Story 5.4 tab actions', () => {
        it("navigateTab('next') with two tabs advances activeTabId to the second tab", () => {
            useTabStore.getState().addTab();
            const { tabs, setActiveTab, navigateTab } = useTabStore.getState();
            setActiveTab(tabs[0].id);

            navigateTab('next');

            expect(useTabStore.getState().activeTabId).toBe(tabs[1].id);
        });

        it("navigateTab('next') on the last tab wraps to the first tab", () => {
            useTabStore.getState().addTab();
            const { tabs, setActiveTab, navigateTab } = useTabStore.getState();
            setActiveTab(tabs[1].id);

            navigateTab('next');

            expect(useTabStore.getState().activeTabId).toBe(tabs[0].id);
        });

        it("navigateTab('prev') on the first tab wraps to the last tab", () => {
            useTabStore.getState().addTab();
            const { tabs, setActiveTab, navigateTab } = useTabStore.getState();
            setActiveTab(tabs[0].id);

            navigateTab('prev');

            expect(useTabStore.getState().activeTabId).toBe(tabs[1].id);
        });

        it('reorderTabs([id2, id1]) swaps tab order and keeps activeTabId unchanged', () => {
            useTabStore.getState().addTab();
            const { tabs, setActiveTab, reorderTabs } = useTabStore.getState();
            const [id1, id2] = [tabs[0].id, tabs[1].id];
            setActiveTab(id1);

            reorderTabs([id2, id1]);

            const state = useTabStore.getState();
            expect(state.tabs.map((tab) => tab.id)).toEqual([id2, id1]);
            expect(state.activeTabId).toBe(id1);
        });

        it('duplicateTab(id) inserts a copy after source and uses a fresh response state', () => {
            const sourceId = useTabStore.getState().tabs[0].id;
            useTabStore.getState().updateTabRequestState(sourceId, {
                method: 'POST',
                url: 'https://api.example.com/items',
                headers: [{ id: crypto.randomUUID(), key: 'x-api-key', value: 'abc', enabled: true }],
            });

            useTabStore.getState().duplicateTab(sourceId);

            const { tabs } = useTabStore.getState();
            expect(tabs).toHaveLength(2);
            expect(tabs[1].requestState).toEqual(tabs[0].requestState);
            expect(tabs[1].requestState).not.toBe(tabs[0].requestState);
            expect(tabs[1].responseState).toEqual(createDefaultResponseSnapshot());
            expect(tabs[1].isCustomLabel).toBe(true);
            expect(tabs[1].label).toBe('New Request (copy)');
        });

        it('duplicateTab(id) makes the new tab active', () => {
            const sourceId = useTabStore.getState().tabs[0].id;
            useTabStore.getState().duplicateTab(sourceId);

            const { tabs, activeTabId } = useTabStore.getState();
            expect(activeTabId).toBe(tabs[1].id);
        });

        it('closeOtherTabs(id) with three tabs leaves only that tab', () => {
            useTabStore.getState().addTab();
            useTabStore.getState().addTab();
            const keepId = useTabStore.getState().tabs[1].id;

            useTabStore.getState().closeOtherTabs(keepId);

            const { tabs, activeTabId } = useTabStore.getState();
            expect(tabs).toHaveLength(1);
            expect(tabs[0].id).toBe(keepId);
            expect(activeTabId).toBe(keepId);
        });

        it("closeAllTabs() leaves exactly one fresh tab with label 'New Request'", () => {
            useTabStore.getState().addTab();
            useTabStore.getState().addTab();

            useTabStore.getState().closeAllTabs();

            const { tabs, activeTabId } = useTabStore.getState();
            expect(tabs).toHaveLength(1);
            expect(tabs[0].label).toBe('New Request');
            expect(tabs[0].isCustomLabel).toBe(false);
            expect(activeTabId).toBe(tabs[0].id);
        });
    });
});
