import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StitchCanvas } from './StitchCanvas';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode } from '@/types/stitch';

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

const makeNode = (overrides: Partial<StitchNode> = {}): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'request',
  positionX: 100,
  positionY: 200,
  config: {},
  label: 'My Request',
  createdAt: 'ts',
  updatedAt: 'ts',
  ...overrides,
});

describe('StitchCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      activeChainId: 'chain-1',
      nodes: [],
      connections: [],
      selectedNodeId: null,
      executionState: 'idle',
    });
  });

  it('renders the canvas area', () => {
    render(<StitchCanvas />);
    expect(screen.getByTestId('stitch-canvas')).toBeInTheDocument();
  });

  it('shows empty state when no nodes', () => {
    render(<StitchCanvas />);
    expect(screen.getByText('Empty canvas')).toBeInTheDocument();
  });

  it('renders nodes at their positions', () => {
    useStitchStore.setState({
      activeChainId: 'chain-1',
      nodes: [
        makeNode({ id: 'n1', positionX: 50, positionY: 75, label: 'First' }),
        makeNode({ id: 'n2', positionX: 300, positionY: 150, label: 'Second', type: 'js-snippet' }),
      ],
    });
    render(<StitchCanvas />);
    expect(screen.getByTestId('stitch-node-n1')).toBeInTheDocument();
    expect(screen.getByTestId('stitch-node-n2')).toBeInTheDocument();
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('renders the add node button', () => {
    render(<StitchCanvas />);
    expect(screen.getByTestId('add-node-button')).toBeInTheDocument();
  });

  it('shows zoom percentage', () => {
    render(<StitchCanvas />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
