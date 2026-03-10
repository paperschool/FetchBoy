import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';

// ─── Mock child components ────────────────────────────────────────────────────
vi.mock('@/components/CollectionTree/CollectionTree', () => ({
    CollectionTree: () => <div data-testid="collection-tree-mock">CollectionTree</div>,
}));

vi.mock('@/components/HistoryPanel/HistoryPanel', () => ({
    HistoryPanel: () => <div data-testid="history-panel-mock">HistoryPanel</div>,
}));

describe('Sidebar', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the sidebar container', () => {
        render(<Sidebar />);
        expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });

    it('shows CollectionTree by default', () => {
        render(<Sidebar />);
        expect(screen.getByTestId('collection-tree-mock')).toBeInTheDocument();
        expect(screen.queryByTestId('history-panel-mock')).not.toBeInTheDocument();
    });

    it('switches to HistoryPanel when History tab is clicked', async () => {
        render(<Sidebar />);
        fireEvent.click(screen.getByRole('button', { name: /history panel/i }));
        await waitFor(() => {
            expect(screen.getByTestId('history-panel-mock')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('collection-tree-mock')).not.toBeInTheDocument();
    });

    it('switches back to CollectionTree when Collections tab is clicked', async () => {
        render(<Sidebar />);
        fireEvent.click(screen.getByRole('button', { name: /history panel/i }));
        await waitFor(() => {
            expect(screen.getByTestId('history-panel-mock')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole('button', { name: /collections panel/i }));
        await waitFor(() => {
            expect(screen.getByTestId('collection-tree-mock')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('history-panel-mock')).not.toBeInTheDocument();
    });
});
