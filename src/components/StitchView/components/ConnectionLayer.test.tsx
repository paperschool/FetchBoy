import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ConnectionLayer } from './ConnectionLayer';
import { StitchConnectionDragProvider } from './StitchConnectionDragContext';
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

describe('ConnectionLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStitchStore.setState({
      chains: [],
      activeChainId: 'chain-1',
      nodes: [],
      connections: [],
      selectedNodeId: null,
      selectedConnectionId: null,
      executionState: 'idle',
    });
  });

  it('renders the SVG layer', () => {
    render(
      <StitchConnectionDragProvider>
        <ConnectionLayer />
      </StitchConnectionDragProvider>,
    );
    expect(screen.getByTestId('connection-layer')).toBeInTheDocument();
  });

  it('renders connection lines for stored connections', () => {
    useStitchStore.setState({
      nodes: [
        { id: 'n1', chainId: 'c', type: 'json-object', positionX: 0, positionY: 0, config: { json: '{"key":1}' }, label: null, createdAt: 'ts', updatedAt: 'ts' },
        { id: 'n2', chainId: 'c', type: 'js-snippet', positionX: 200, positionY: 200, config: { code: '' }, label: null, createdAt: 'ts', updatedAt: 'ts' },
      ],
      connections: [
        { id: 'conn-1', chainId: 'c', sourceNodeId: 'n1', sourceKey: 'key', targetNodeId: 'n2', targetSlot: 'input', createdAt: 'ts' },
      ],
    });
    render(
      <StitchConnectionDragProvider>
        <ConnectionLayer />
      </StitchConnectionDragProvider>,
    );
    expect(screen.getAllByTestId('connection-line')).toHaveLength(1);
  });

  it('renders no lines when no connections', () => {
    render(
      <StitchConnectionDragProvider>
        <ConnectionLayer />
      </StitchConnectionDragProvider>,
    );
    expect(screen.queryByTestId('connection-line')).not.toBeInTheDocument();
  });

  it('labels an unlabelled line out of a JS snippet node with the snippet name', () => {
    useStitchStore.setState({
      nodes: [
        { id: 's', chainId: 'c', type: 'js-snippet', positionX: 0, positionY: 0, config: { code: '' }, label: 'My Snippet', createdAt: 'ts', updatedAt: 'ts' },
        { id: 't', chainId: 'c', type: 'json-object', positionX: 200, positionY: 200, config: { json: '{}' }, label: null, createdAt: 'ts', updatedAt: 'ts' },
      ],
      connections: [
        { id: 'conn-1', chainId: 'c', sourceNodeId: 's', sourceKey: null, targetNodeId: 't', targetSlot: 'input', createdAt: 'ts' },
      ],
    });
    render(
      <StitchConnectionDragProvider>
        <ConnectionLayer />
      </StitchConnectionDragProvider>,
    );
    expect(screen.getByText('My Snippet')).toBeInTheDocument();
  });

  it('updates the line label when the JS snippet node is renamed', () => {
    useStitchStore.setState({
      nodes: [
        { id: 's', chainId: 'c', type: 'js-snippet', positionX: 0, positionY: 0, config: { code: '' }, label: 'Old Name', createdAt: 'ts', updatedAt: 'ts' },
        { id: 't', chainId: 'c', type: 'json-object', positionX: 200, positionY: 200, config: { json: '{}' }, label: null, createdAt: 'ts', updatedAt: 'ts' },
      ],
      connections: [
        { id: 'conn-1', chainId: 'c', sourceNodeId: 's', sourceKey: null, targetNodeId: 't', targetSlot: 'input', createdAt: 'ts' },
      ],
    });
    render(
      <StitchConnectionDragProvider>
        <ConnectionLayer />
      </StitchConnectionDragProvider>,
    );
    expect(screen.getByText('Old Name')).toBeInTheDocument();

    act(() => {
      useStitchStore.setState((s) => ({
        nodes: s.nodes.map((n) => (n.id === 's' ? { ...n, label: 'New Name' } : n)),
      }));
    });
    expect(screen.queryByText('Old Name')).not.toBeInTheDocument();
    expect(screen.getByText('New Name')).toBeInTheDocument();
  });
});
