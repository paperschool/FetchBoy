import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HistoryEntry } from '@/lib/db';
import { useHistoryStore } from '@/stores/historyStore';
import { useRequestStore } from '@/stores/requestStore';
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
const resetRequestStore = () =>
    useRequestStore.setState({
        method: 'GET',
        url: '',
        headers: [],
        queryParams: [],
        body: { mode: 'raw', raw: '' },
        auth: { type: 'none' },
        activeTab: 'headers',
        isDirty: false,
    });

describe('HistoryPanel', () => {
    beforeEach(() => {
        resetHistoryStore();
        resetRequestStore();
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

    it('calls requestStore.loadFromSaved with entry snapshot on row click', async () => {
        const snapshot = makeSnapshot();
        const entry = makeEntry({ id: 'click-me', request_snapshot: snapshot });
        useHistoryStore.setState({ entries: [entry] });

        render(<HistoryPanel />);

        fireEvent.click(screen.getByTestId('history-row-click-me'));
        expect(useRequestStore.getState().url).toBe(snapshot.url);
    });

    it('prompts dirty guard when isDirty is true and cancelling prevents load', async () => {
        const entry = makeEntry({ id: 'dirty-test' });
        useHistoryStore.setState({ entries: [entry] });
        useRequestStore.setState({ isDirty: true } as ReturnType<typeof useRequestStore.getState>);

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
        const loadFromSaved = vi.spyOn(useRequestStore.getState(), 'loadFromSaved');

        render(<HistoryPanel />);
        fireEvent.click(screen.getByTestId('history-row-dirty-test'));

        expect(confirmSpy).toHaveBeenCalledWith(
            'You have unsaved changes. Discard and load this request?',
        );
        expect(loadFromSaved).not.toHaveBeenCalled();
        confirmSpy.mockRestore();
    });

    it('calls clearHistory and historyStore.clearAll on confirmed clear', async () => {
        const entry = makeEntry();
        useHistoryStore.setState({ entries: [entry] });

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<HistoryPanel />);
        fireEvent.click(screen.getByLabelText('Clear History'));

        await waitFor(() => {
            expect(mockClearHistory).toHaveBeenCalledOnce();
        });
        expect(useHistoryStore.getState().entries).toHaveLength(0);
        confirmSpy.mockRestore();
    });

    it('does not clear when user cancels the confirmation', async () => {
        const entry = makeEntry();
        useHistoryStore.setState({ entries: [entry] });

        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        render(<HistoryPanel />);
        fireEvent.click(screen.getByLabelText('Clear History'));

        expect(mockClearHistory).not.toHaveBeenCalled();
        expect(useHistoryStore.getState().entries).toHaveLength(1);
        confirmSpy.mockRestore();
    });
});
