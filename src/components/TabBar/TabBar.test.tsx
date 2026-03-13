import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from '@/stores/tabStore';
import { TabBar } from './TabBar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetTabStore() {
    const firstTab = {
        id: crypto.randomUUID(),
        label: 'New Request',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: createDefaultResponseSnapshot(),
    };
    useTabStore.setState({ tabs: [firstTab], activeTabId: firstTab.id });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TabBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetTabStore();
    });

    it('renders the single default tab and "+" button', () => {
        render(<TabBar />);
        expect(screen.getByText('New Request')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New tab' })).toBeInTheDocument();
    });

    it('clicking "+" button creates a second tab that becomes active', () => {
        render(<TabBar />);
        const addButton = screen.getByRole('button', { name: 'New tab' });
        fireEvent.click(addButton);
        const tabs = screen.getAllByRole('tab');
        expect(tabs).toHaveLength(2);
        const { activeTabId, tabs: storeTabs } = useTabStore.getState();
        expect(activeTabId).toBe(storeTabs[1].id);
    });

    it('clicking a tab body calls setActiveTab', () => {
        // Add a second tab first so we can click the first one
        useTabStore.getState().addTab();
        const { tabs } = useTabStore.getState();
        useTabStore.getState().setActiveTab(tabs[1].id); // make second tab active

        render(<TabBar />);
        const allTabs = screen.getAllByRole('tab');
        fireEvent.click(allTabs[0]); // click first tab

        expect(useTabStore.getState().activeTabId).toBe(tabs[0].id);
    });

    it('close button removes a tab when two tabs exist', () => {
        useTabStore.getState().addTab();
        render(<TabBar />);
        const closeButtons = screen.getAllByRole('button', { name: /Close tab/i });
        fireEvent.click(closeButtons[0]);
        expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('attempting to close the last tab does nothing (tab count remains 1)', () => {
        render(<TabBar />);
        fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 20 });
        fireEvent.click(screen.getByRole('menuitem', { name: /^Close Tab/i }));
        expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('double-clicking a tab label shows an input pre-filled with current label', () => {
        render(<TabBar />);
        const label = screen.getByText('New Request');
        fireEvent.dblClick(label);
        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe('New Request');
    });

    it('pressing Enter during rename confirms and updates the tab label', () => {
        render(<TabBar />);
        const label = screen.getByText('New Request');
        fireEvent.dblClick(label);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Renamed Tab' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(screen.getByText('Renamed Tab')).toBeInTheDocument();
        expect(useTabStore.getState().tabs[0].label).toBe('Renamed Tab');
        expect(useTabStore.getState().tabs[0].isCustomLabel).toBe(true);
    });

    it('pressing Escape during rename reverts to original label', () => {
        render(<TabBar />);
        const label = screen.getByText('New Request');
        fireEvent.dblClick(label);
        const input = screen.getByRole('textbox');
        fireEvent.change(input, { target: { value: 'Temporary Edit' } });
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.getByText('New Request')).toBeInTheDocument();
        expect(useTabStore.getState().tabs[0].label).toBe('New Request');
    });

    it('shows shortcut hint in the New tab button title', () => {
        render(<TabBar />);
        const addButton = screen.getByRole('button', { name: 'New tab' });
        expect(addButton.getAttribute('title')).toMatch(/New Tab \((⌘T|Ctrl\+T)\)/);
    });

    it('opens tab context menu on right click and duplicates tab', () => {
        render(<TabBar />);
        const tab = screen.getByRole('tab');

        fireEvent.contextMenu(tab, { clientX: 10, clientY: 20 });
        expect(screen.getByRole('menu')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('menuitem', { name: /Duplicate Tab/i }));
        expect(useTabStore.getState().tabs).toHaveLength(2);
        expect(useTabStore.getState().tabs[1].label).toBe('New Request (copy)');
    });

    it('Close Other Tabs is disabled when only one tab exists', () => {
        render(<TabBar />);
        fireEvent.contextMenu(screen.getByRole('tab'), { clientX: 10, clientY: 20 });

        const item = screen.getByRole('menuitem', { name: /Close Other Tabs/i });
        fireEvent.click(item);

        expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('Close All Tabs keeps exactly one fresh tab', () => {
        useTabStore.getState().addTab();
        useTabStore.getState().addTab();
        render(<TabBar />);

        fireEvent.contextMenu(screen.getAllByRole('tab')[1], { clientX: 10, clientY: 20 });
        fireEvent.click(screen.getByRole('menuitem', { name: /Close All Tabs/i }));

        const { tabs, activeTabId } = useTabStore.getState();
        expect(tabs).toHaveLength(1);
        expect(tabs[0].label).toBe('New Request');
        expect(activeTabId).toBe(tabs[0].id);
    });
});
