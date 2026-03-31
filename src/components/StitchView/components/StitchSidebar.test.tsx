import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchSidebar } from './StitchSidebar';
import { useStitchStore } from '@/stores/stitchStore';

vi.mock('@/lib/stitch', () => ({
  loadChains: vi.fn().mockResolvedValue([]),
  loadChainWithNodes: vi.fn(),
  insertChain: vi.fn().mockResolvedValue({ id: 'new', name: 'Chain 1', createdAt: 'ts', updatedAt: 'ts' }),
  updateChain: vi.fn().mockResolvedValue(undefined),
  deleteChain: vi.fn().mockResolvedValue(undefined),
  duplicateChain: vi.fn().mockResolvedValue({ chain: { id: 'dup', name: 'Copy', createdAt: 'ts', updatedAt: 'ts' }, nodes: [], connections: [] }),
  insertNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  insertConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));

const defaultProps = {
  collapsed: false,
  onToggleCollapse: vi.fn(),
};

describe('StitchSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      activeChainId: null,
      nodes: [],
      connections: [],
      selectedNodeId: null,
      executionState: 'idle',
    });
  });

  it('renders empty state when no chains', () => {
    render(<StitchSidebar {...defaultProps} />);
    expect(screen.getByTestId('empty-chains')).toBeInTheDocument();
    expect(screen.getByText('No chains yet')).toBeInTheDocument();
  });

  it('renders "Create Chain" button in empty state', () => {
    render(<StitchSidebar {...defaultProps} />);
    expect(screen.getByTestId('create-first-chain')).toBeInTheDocument();
  });

  it('renders chain list when chains exist', () => {
    useStitchStore.setState({
      chains: [
        { id: 'c1', name: 'Auth Flow', createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 'c2', name: 'Pipeline', createdAt: '2026-01-02', updatedAt: '2026-01-02' },
      ],
    });
    render(<StitchSidebar {...defaultProps} />);
    expect(screen.getByTestId('chain-list')).toBeInTheDocument();
    expect(screen.getByText('Auth Flow')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('highlights active chain', () => {
    useStitchStore.setState({
      chains: [
        { id: 'c1', name: 'Auth Flow', createdAt: 'ts', updatedAt: 'ts' },
      ],
      activeChainId: 'c1',
    });
    render(<StitchSidebar {...defaultProps} />);
    const entry = screen.getByTestId('chain-entry-c1');
    expect(entry.className).toContain('bg-blue-500/10');
  });

  it('shows delete confirmation dialog', () => {
    useStitchStore.setState({
      chains: [{ id: 'c1', name: 'Test Chain', createdAt: 'ts', updatedAt: 'ts' }],
    });
    render(<StitchSidebar {...defaultProps} />);

    // Open context menu
    fireEvent.contextMenu(screen.getByTestId('chain-entry-c1'));
    // Click delete
    fireEvent.click(screen.getByText('Delete'));
    // Confirmation dialog appears
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
  });

  it('cancel button dismisses delete dialog', () => {
    useStitchStore.setState({
      chains: [{ id: 'c1', name: 'Test Chain', createdAt: 'ts', updatedAt: 'ts' }],
    });
    render(<StitchSidebar {...defaultProps} />);

    fireEvent.contextMenu(screen.getByTestId('chain-entry-c1'));
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByTestId('delete-cancel'));
    expect(screen.queryByTestId('delete-dialog')).not.toBeInTheDocument();
  });

  it('renders collapsed state with expand button', () => {
    render(<StitchSidebar {...defaultProps} collapsed={true} />);
    expect(screen.getByTestId('stitch-sidebar-collapsed')).toBeInTheDocument();
    expect(screen.getByTitle('Expand sidebar')).toBeInTheDocument();
  });

  it('sorts chains by updatedAt descending', () => {
    useStitchStore.setState({
      chains: [
        { id: 'c1', name: 'Older', createdAt: 'ts', updatedAt: '2026-01-01T00:00:00Z' },
        { id: 'c2', name: 'Newer', createdAt: 'ts', updatedAt: '2026-03-01T00:00:00Z' },
      ],
    });
    render(<StitchSidebar {...defaultProps} />);
    const entries = screen.getAllByTestId(/chain-entry-/);
    // Newer should come first
    expect(entries[0]).toHaveAttribute('data-testid', 'chain-entry-c2');
    expect(entries[1]).toHaveAttribute('data-testid', 'chain-entry-c1');
  });
});
