import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SleepNodeEditor } from './SleepNodeEditor';
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

const makeSleepNode = (config: Record<string, unknown> = {}, label = 'Wait'): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'sleep',
  positionX: 0,
  positionY: 0,
  config: { mode: 'fixed', durationMs: 1000, minMs: 500, maxMs: 2000, ...config },
  label,
  createdAt: 'ts',
  updatedAt: 'ts',
});

describe('SleepNodeEditor', () => {
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

  it('renders the panel header with node label', () => {
    render(<SleepNodeEditor node={makeSleepNode()} />);
    expect(screen.getByText('Sleep — Wait')).toBeInTheDocument();
  });

  it('renders Fixed and Random mode buttons', () => {
    render(<SleepNodeEditor node={makeSleepNode()} />);
    expect(screen.getByTestId('mode-fixed')).toBeInTheDocument();
    expect(screen.getByTestId('mode-random')).toBeInTheDocument();
  });

  it('shows duration input in fixed mode', () => {
    render(<SleepNodeEditor node={makeSleepNode()} />);
    expect(screen.getByTestId('duration-input')).toBeInTheDocument();
    expect(screen.queryByTestId('min-input')).not.toBeInTheDocument();
  });

  it('shows min/max inputs in random mode', () => {
    render(<SleepNodeEditor node={makeSleepNode({ mode: 'random' })} />);
    expect(screen.getByTestId('min-input')).toBeInTheDocument();
    expect(screen.getByTestId('max-input')).toBeInTheDocument();
    expect(screen.queryByTestId('duration-input')).not.toBeInTheDocument();
  });

  it('shows validation error when min > max', () => {
    render(<SleepNodeEditor node={makeSleepNode({ mode: 'random', minMs: 3000, maxMs: 1000 })} />);
    expect(screen.getByTestId('validation-error')).toHaveTextContent('Min must be ≤ Max');
  });

  it('does not show validation error when min <= max', () => {
    render(<SleepNodeEditor node={makeSleepNode({ mode: 'random', minMs: 500, maxMs: 2000 })} />);
    expect(screen.queryByTestId('validation-error')).not.toBeInTheDocument();
  });

  it('switches to random mode when Random button is clicked', () => {
    const updateNode = vi.fn().mockResolvedValue(undefined);
    useStitchStore.setState({ updateNode });
    render(<SleepNodeEditor node={makeSleepNode()} />);
    fireEvent.click(screen.getByTestId('mode-random'));
    expect(updateNode).toHaveBeenCalledWith('node-1', expect.objectContaining({
      config: expect.objectContaining({ mode: 'random' }),
    }));
  });
});
