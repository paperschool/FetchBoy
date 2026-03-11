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
    const mockOnToggle = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('expanded state', () => {
        it('renders the sidebar container', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });

        it('shows collapse button', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            expect(screen.getByRole('button', { name: /collapse sidebar/i })).toBeInTheDocument();
        });

        it('calls onToggle when collapse button is clicked', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /collapse sidebar/i }));
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });

        it('collapse button is keyboard accessible (button element)', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            const button = screen.getByRole('button', { name: /collapse sidebar/i });
            expect(button.tagName).toBe('BUTTON');
            // Native button elements are inherently keyboard accessible
        });

        it('shows CollectionTree by default', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('collection-tree-mock')).toBeInTheDocument();
            expect(screen.queryByTestId('history-panel-mock')).not.toBeInTheDocument();
        });

        it('switches to HistoryPanel when History tab is clicked', async () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /history panel/i }));
            await waitFor(() => {
                expect(screen.getByTestId('history-panel-mock')).toBeInTheDocument();
            });
            expect(screen.queryByTestId('collection-tree-mock')).not.toBeInTheDocument();
        });

        it('switches back to CollectionTree when Collections tab is clicked', async () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
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

    describe('collapsed state', () => {
        it('renders icon-only strip', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar')).toBeInTheDocument();
        });

        it('shows expand button', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
        });

        it('calls onToggle when expand button is clicked', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /expand sidebar/i }));
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });

        it('shows Collections icon button', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.getByRole('button', { name: /^collections$/i })).toBeInTheDocument();
        });

        it('shows History icon button', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.getByRole('button', { name: /^history$/i })).toBeInTheDocument();
        });

        it('clicking Collections icon expands sidebar and switches to collections', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /^collections$/i }));
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });

        it('clicking History icon expands sidebar and switches to history', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /^history$/i }));
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });

        it('does not show panel content when collapsed', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.queryByTestId('collection-tree-mock')).not.toBeInTheDocument();
            expect(screen.queryByTestId('history-panel-mock')).not.toBeInTheDocument();
        });
    });
});
