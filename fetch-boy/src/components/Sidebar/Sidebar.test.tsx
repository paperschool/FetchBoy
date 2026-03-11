import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Sidebar } from './Sidebar';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockStoreState } = vi.hoisted(() => {
    const mockStoreState = {
        sidebarSettingsExpanded: false,
        setSidebarSettingsExpanded: vi.fn(),
    };
    return { mockStoreState };
});

// ─── Mock child components ────────────────────────────────────────────────────
vi.mock('@/components/CollectionTree/CollectionTree', () => ({
    CollectionTree: () => <div data-testid="collection-tree-mock">CollectionTree</div>,
}));

vi.mock('@/components/HistoryPanel/HistoryPanel', () => ({
    HistoryPanel: () => <div data-testid="history-panel-mock">HistoryPanel</div>,
}));

vi.mock('./SettingsAccordion', () => ({
    SettingsAccordion: ({
        isExpanded,
        onToggle,
    }: {
        isExpanded: boolean;
        onToggle: () => void;
    }) => (
        <div data-testid="settings-accordion-mock">
            <button onClick={onToggle} data-testid="settings-accordion-toggle-mock">
                {isExpanded ? 'Collapse Settings' : 'Expand Settings'}
            </button>
            {isExpanded && <div data-testid="settings-content-mock">Settings Content</div>}
        </div>
    ),
}));

vi.mock('@/stores/uiSettingsStore', () => ({
    useUiSettingsStore: (selector: (s: typeof mockStoreState) => unknown) =>
        selector(mockStoreState),
}));

vi.mock('@/lib/settings', () => ({
    saveSetting: vi.fn().mockResolvedValue(undefined),
}));

describe('Sidebar', () => {
    const mockOnToggle = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.sidebarSettingsExpanded = false;
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

        it('shows Settings icon button in collapsed strip', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            expect(screen.getByRole('button', { name: /^settings$/i })).toBeInTheDocument();
        });

        it('clicking Settings icon expands sidebar and sets settings expanded', () => {
            render(<Sidebar collapsed={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
            expect(mockStoreState.setSidebarSettingsExpanded).toHaveBeenCalledWith(true);
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });
    });

    describe('settings accordion', () => {
        it('renders SettingsAccordion in expanded sidebar', () => {
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('settings-accordion-mock')).toBeInTheDocument();
        });

        it('passes sidebarSettingsExpanded from store to SettingsAccordion', () => {
            mockStoreState.sidebarSettingsExpanded = true;
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('settings-content-mock')).toBeInTheDocument();
        });

        it('calls setSidebarSettingsExpanded and saveSetting when accordion toggles', async () => {
            const { saveSetting } = await import('@/lib/settings');
            mockStoreState.sidebarSettingsExpanded = false;
            render(<Sidebar collapsed={false} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('settings-accordion-toggle-mock'));
            expect(mockStoreState.setSidebarSettingsExpanded).toHaveBeenCalledWith(true);
            expect(saveSetting).toHaveBeenCalledWith('sidebar_settings_expanded', true);
        });
    });
});
