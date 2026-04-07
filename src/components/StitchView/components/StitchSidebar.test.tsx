import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StitchSidebar } from './StitchSidebar';
import { useStitchStore } from '@/stores/stitchStore';

vi.mock('@/lib/stitch', () => ({
  loadChains: vi.fn().mockResolvedValue([]),
  loadChainWithNodes: vi.fn(),
  insertChain: vi.fn().mockResolvedValue({ id: 'new', name: 'Chain 1', mappingId: null, folderId: null, sortOrder: 0, createdAt: 'ts', updatedAt: 'ts' }),
  updateChain: vi.fn().mockResolvedValue(undefined),
  deleteChain: vi.fn().mockResolvedValue(undefined),
  duplicateChain: vi.fn().mockResolvedValue({ chain: { id: 'dup', name: 'Copy', mappingId: null, folderId: null, sortOrder: 0, createdAt: 'ts', updatedAt: 'ts' }, nodes: [], connections: [] }),
  insertNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  insertConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));

vi.mock('@/lib/stitchFolders', () => ({
  loadStitchFolders: vi.fn().mockResolvedValue([]),
  createStitchFolder: vi.fn().mockResolvedValue({ id: 'f1', parentId: null, name: 'New Folder', sortOrder: 0, createdAt: 'ts', updatedAt: 'ts' }),
  renameStitchFolder: vi.fn().mockResolvedValue(undefined),
  deleteStitchFolder: vi.fn().mockResolvedValue(undefined),
  updateStitchFolderOrder: vi.fn().mockResolvedValue(undefined),
  updateChainFolder: vi.fn().mockResolvedValue(undefined),
  updateChainOrder: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  collapsed: false,
  onToggleCollapse: vi.fn(),
};

function makeChain(id: string, name: string, sortOrder = 0, updatedAt = 'ts') {
  return { id, name, mappingId: null, requestId: null, folderId: null, sortOrder, createdAt: 'ts', updatedAt };
}

describe('StitchSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      folders: [],
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
      chains: [makeChain('c1', 'Auth Flow'), makeChain('c2', 'Pipeline', 1)],
    });
    render(<StitchSidebar {...defaultProps} />);
    expect(screen.getByTestId('chain-list')).toBeInTheDocument();
    expect(screen.getByText('Auth Flow')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });

  it('highlights active chain', () => {
    useStitchStore.setState({
      chains: [makeChain('c1', 'Auth Flow')],
      activeChainId: 'c1',
    });
    render(<StitchSidebar {...defaultProps} />);
    const entry = screen.getByTestId('chain-entry-c1');
    expect(entry.className).toContain('bg-blue-500/10');
  });

  it('shows delete confirmation dialog', () => {
    useStitchStore.setState({
      chains: [makeChain('c1', 'Test Chain')],
    });
    render(<StitchSidebar {...defaultProps} />);
    fireEvent.contextMenu(screen.getByTestId('chain-entry-c1'));
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByTestId('delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/This cannot be undone/)).toBeInTheDocument();
  });

  it('cancel button dismisses delete dialog', () => {
    useStitchStore.setState({
      chains: [makeChain('c1', 'Test Chain')],
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

  it('sorts chains by sortOrder ascending', () => {
    useStitchStore.setState({
      chains: [makeChain('c1', 'Second', 1), makeChain('c2', 'First', 0)],
    });
    render(<StitchSidebar {...defaultProps} />);
    const entries = screen.getAllByTestId(/chain-entry-/);
    expect(entries[0]).toHaveAttribute('data-testid', 'chain-entry-c2');
    expect(entries[1]).toHaveAttribute('data-testid', 'chain-entry-c1');
  });
});
