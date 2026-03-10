import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from './tabStore';

const getInitialState = () => {
    const firstTab = { id: crypto.randomUUID(), label: 'New Request', isCustomLabel: false };
    return {
        tabs: [firstTab],
        activeTabId: firstTab.id,
    };
};

describe('tabStore', () => {
    beforeEach(() => {
        const firstTab = { id: crypto.randomUUID(), label: 'New Request', isCustomLabel: false };
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
});
