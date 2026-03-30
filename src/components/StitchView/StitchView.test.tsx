import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StitchView } from './StitchView';
import { useStitchStore } from '@/stores/stitchStore';

vi.mock('@/lib/stitch', () => ({
  loadChains: vi.fn().mockResolvedValue([]),
  loadChainWithNodes: vi.fn(),
  insertChain: vi.fn(),
  updateChain: vi.fn(),
  deleteChain: vi.fn(),
  insertNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  insertConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));

describe('StitchView', () => {
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

  it('renders the heading', () => {
    render(<StitchView />);
    expect(screen.getByText('Stitch — Request Chain Builder')).toBeInTheDocument();
  });

  it('shows empty state when no chains', () => {
    render(<StitchView />);
    expect(screen.getByText('No chains yet')).toBeInTheDocument();
  });

  it('renders chain names in sidebar', () => {
    useStitchStore.setState({
      chains: [
        { id: 'c1', name: 'Auth Flow', createdAt: 'ts', updatedAt: 'ts' },
        { id: 'c2', name: 'Data Pipeline', createdAt: 'ts', updatedAt: 'ts' },
      ],
    });
    render(<StitchView />);
    expect(screen.getByText('Auth Flow')).toBeInTheDocument();
    expect(screen.getByText('Data Pipeline')).toBeInTheDocument();
  });
});
