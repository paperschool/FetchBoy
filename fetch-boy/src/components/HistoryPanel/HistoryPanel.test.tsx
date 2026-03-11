import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HistoryEntry } from '@/lib/db';
import { useHistoryStore } from '@/stores/historyStore';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from '@/stores/tabStore';
import { HistoryPanel } from './HistoryPanel';

// ─── Mock history lib ─────────────────────────────────────────────────────────
const mockLoadHistory = vi.fn();
const mockClearHistory = vi.fn();

vi.mock('@/lib/history', () => ({
    loadHistory: () => mockLoadHistory(),
    clearHistory: () => mockClearHistory(),
    persistHistoryEntry: vi.fn(),
}));

// ─── Mock utils ───────────────────────────────────────────────────────────────
vi.mock('@/lib/utils', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/lib/utils')>();
    return {
        ...actual,
        formatRelativeTime: () => 'just now',
    };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeSnapshot = (): HistoryEntry['request_snapshot'] => ({
    id: 'req-1',
    collection_id: null,
    folder_id: null,
    name: 'Test Request',
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    query_params: [],
    body_type: 'none',
    body_content: '',
    auth_type: 'none',
    auth_config: {},
    sort_order: 0,
    created_at: '',
    updated_at: '',
});

const makeEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
    id: crypto.randomUUID(),
    method: 'GET',
    url: 'https://example.com',
    status_code: 200,
    response_time_ms: 100,
    request_snapshot: makeSnapshot(),
    sent_at: new Date().toISOString(),
    ...overrides,
});

const resetHistoryStore = () => useHistoryStore.setState({ entries: [] });
const resetTabStore = () => {
    const freshTab = {
        id: 'test-tab-1',
        label: 'New Request',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: createDefaultResponseSnapshot(),
    };
    useTabStore.setState({ tabs: [freshTab], activeTabId: freshTab.id });
};

describe('HistoryPanel', () => {
    beforeEach(() => {
        resetHistoryStore();
        resetTabStore();
        vi.clearAllMocks();
        mockLoadHistory.mockResolvedValue([]);
        mockClearHistory.mockResolvedValue(undefined);
    });

    it('shows empty state when there are no entries', async () => {
        render(<HistoryPanel />);
        await waitFor(() => {
            expect(screen.getByTestId('history-empty-state')).toBeInTheDocument();
        });
        expect(
            screen.getByText('No history yet. Send a request to get started.'),
        ).toBeInTheDocument();
    });

    it('renders history rows for seeded entries', async () => {
        const entries = [
            makeEntry({ id: 'e1', url: 'https://a.com', method: 'GET' }),
            makeEntry({ id: 'e2', url: 'https://b.com', method: 'POST' }),
            makeEntry({ id: 'e3', url: 'https://c.com', method: 'DELETE' }),
        ];
        useHistoryStore.setState({ entries });
        mockLoadHistory.mockResolvedValue(entries);

        render(<HistoryPanel />);
        await waitFor(() => {
            expect(screen.getByTestId('history-row-e1')).toBeInTheDocument();
        });
        expect(screen.getByTestId('history-row-e2')).toBeInTheDocument();
        expect(screen.getByTestId('history-row-e3')).toBeInTheDocument();
    });

    it('calls updateTabRequestState with entry snapshot on row click', async () => {
        const snapshot = makeSnapshot();
        const entry = makeEntry({ id: 'click-me', request_snapshot: snapshot });
        useHistoryStore.setState({ entries: [entry] });

        render(<HistoryPanel />);

        fireEvent.click(screen.getByTestId('history-row-click-me'));
        const { activeTabId, tabs } = useTabStore.getState();
        expect(tabs.find((t) => t.id === activeTabId)?.requestState.url).toBe(snapshot.url);
    });

    it('prompts dirty guard when isDirty is true and cancelling prevents load', async () => {
        const entrySnapshot = makeSnapshot({ url: 'https://new-entry.com' });
        const entry = makeEntry({ id: 'dirty-test', request_snapshot: entrySnapshot });
        useHistoryStore.setState({ entries: [entry] });
        const { activeTabId } = useTabStore.getState();
        useTabStore.getState().updateTabRequestState(activeTabId, { isDirty: true, url: 'https://original.com' });

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        render(<HistoryPanel />);
        fireEvent.click(screen.getByTestId('history-row-dirty-test'));

        expect(confirmSpy).toHaveBeenCalledWith(
            'You have unsaved changes. Discard and load this request?',
        );
        // url should remain unchanged — load was blocked
        const { tabs } = useTabStore.getState();
        expect(tabs.find((t) => t.id === activeTabId)?.requestState.url).toBe('https://original.com');
        confirmSpy.mockRestore();
    });

    it('calls clearHistory and historyStore.clearAll on confirmed clear', async () => {
        const entry = makeEntry();
        useHistoryStore.setState({ entries: [entry] });

        render(<HistoryPanel />);
        // First click: enter confirm state
        fireEvent.click(screen.getByLabelText('Clear History'));
        // Confirm button should now be visible
        expect(screen.getByLabelText('Confirm clear history')).toBeInTheDocument();
        // Second click: confirm
        fireEvent.click(screen.getByLabelText('Confirm clear history'));

        await waitFor(() => {
            expect(mockClearHistory).toHaveBeenCalledOnce();
        });
        expect(useHistoryStore.getState().entries).toHaveLength(0);
    });

    it('cancels the clear when cancel button is clicked', async () => {
        const entry = makeEntry();
        useHistoryStore.setState({ entries: [entry] });

        render(<HistoryPanel />);
        fireEvent.click(screen.getByLabelText('Clear History'));
        expect(screen.getByLabelText('Cancel clear history')).toBeInTheDocument();
        fireEvent.click(screen.getByLabelText('Cancel clear history'));

        expect(mockClearHistory).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().entries).toHaveLength(1);
        // Trash button should be visible again
        expect(screen.getByLabelText('Clear History')).toBeInTheDocument();
    });

    describe('open in new tab', () => {
        it('right-clicking a history row shows "Open in New Tab" menu item', async () => {
            const entry = makeEntry({ id: 'ctx-entry' });
            useHistoryStore.setState({ entries: [entry] });
            mockLoadHistory.mockResolvedValue([entry]);

            render(<HistoryPanel />);
            await waitFor(() => screen.getByTestId('history-row-ctx-entry'));

            fireEvent.contextMenu(screen.getByTestId('history-row-ctx-entry'));

            expect(screen.getByRole('menu')).toBeInTheDocument();
            expect(screen.getByRole('menuitem', { name: 'Open in New Tab' })).toBeInTheDocument();
        });

        it('clicking "Open in New Tab" opens entry in a new tab with correct label and state', async () => {
            const snapshot = makeSnapshot();
            const entry = makeEntry({ id: 'new-tab-entry', method: 'POST', url: 'https://api.example.com', request_snapshot: { ...snapshot, method: 'POST', url: 'https://api.example.com' } });
            useHistoryStore.setState({ entries: [entry] });
            mockLoadHistory.mockResolvedValue([entry]);

            render(<HistoryPanel />);
            await waitFor(() => screen.getByTestId('history-row-new-tab-entry'));

            fireEvent.contextMenu(screen.getByTestId('history-row-new-tab-entry'));
            fireEvent.click(screen.getByRole('menuitem', { name: 'Open in New Tab' }));

            const { tabs, activeTabId } = useTabStore.getState();
            expect(tabs).toHaveLength(2);
            expect(activeTabId).toBe(tabs[1].id);
            expect(tabs[1].isCustomLabel).toBe(true);
            expect(tabs[1].requestState.url).toBe('https://api.example.com');
        });

        it('left-clicking still calls the original handler and does NOT open a new tab', async () => {
            const entry = makeEntry({ id: 'left-click-entry' });
            useHistoryStore.setState({ entries: [entry] });
            mockLoadHistory.mockResolvedValue([entry]);

            render(<HistoryPanel />);
            await waitFor(() => screen.getByTestId('history-row-left-click-entry'));

            fireEvent.click(screen.getByTestId('history-row-left-click-entry'));

            const { tabs } = useTabStore.getState();
            expect(tabs).toHaveLength(1);
            // Existing tab updated with entry's snapshot url
            expect(tabs[0].requestState.url).toBe(entry.request_snapshot.url);
        });
    });
});
