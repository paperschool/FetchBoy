import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStitchStore } from './stitchStore';
import type { StitchChain, StitchNode, StitchConnection } from '@/types/stitch';

vi.mock('@/lib/stitch', () => ({
  loadChains: vi.fn(),
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

const makeChain = (overrides: Partial<StitchChain> = {}): StitchChain => ({
  id: 'chain-1',
  name: 'Test Chain',
  createdAt: 'ts',
  updatedAt: 'ts',
  ...overrides,
});

const makeNode = (overrides: Partial<StitchNode> = {}): StitchNode => ({
  id: 'node-1',
  chainId: 'chain-1',
  type: 'request',
  positionX: 0,
  positionY: 0,
  config: {},
  label: null,
  createdAt: 'ts',
  updatedAt: 'ts',
  ...overrides,
});

const makeConn = (overrides: Partial<StitchConnection> = {}): StitchConnection => ({
  id: 'conn-1',
  chainId: 'chain-1',
  sourceNodeId: 'node-1',
  sourceKey: 'out',
  targetNodeId: 'node-2',
  targetSlot: 'in',
  createdAt: 'ts',
  ...overrides,
});

const resetStore = (): void =>
  useStitchStore.setState({
    chains: [],
    activeChainId: null,
    nodes: [],
    connections: [],
    selectedNodeId: null,
    executionState: 'idle',
  });

describe('stitchStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  it('initializes with empty state', () => {
    const s = useStitchStore.getState();
    expect(s.chains).toEqual([]);
    expect(s.activeChainId).toBeNull();
    expect(s.nodes).toEqual([]);
    expect(s.connections).toEqual([]);
    expect(s.selectedNodeId).toBeNull();
    expect(s.executionState).toBe('idle');
  });

  describe('loadChains', () => {
    it('loads chains from DB into state', async () => {
      const stitchDb = await import('@/lib/stitch');
      const chains = [makeChain(), makeChain({ id: 'chain-2', name: 'Second' })];
      vi.mocked(stitchDb.loadChains).mockResolvedValue(chains);

      await useStitchStore.getState().loadChains();
      expect(useStitchStore.getState().chains).toEqual(chains);
    });
  });

  describe('loadChain', () => {
    it('loads a full chain into state', async () => {
      const stitchDb = await import('@/lib/stitch');
      const chain = makeChain();
      const nodes = [makeNode()];
      const connections = [makeConn()];
      vi.mocked(stitchDb.loadChainWithNodes).mockResolvedValue({ chain, nodes, connections });

      useStitchStore.setState({ chains: [chain] });
      await useStitchStore.getState().loadChain('chain-1');

      const s = useStitchStore.getState();
      expect(s.activeChainId).toBe('chain-1');
      expect(s.nodes).toEqual(nodes);
      expect(s.connections).toEqual(connections);
      expect(s.selectedNodeId).toBeNull();
      expect(s.executionState).toBe('idle');
    });
  });

  describe('createChain', () => {
    it('creates chain and adds to state', async () => {
      const stitchDb = await import('@/lib/stitch');
      const chain = makeChain();
      vi.mocked(stitchDb.insertChain).mockResolvedValue(chain);

      const result = await useStitchStore.getState().createChain('Test Chain');
      expect(result).toEqual(chain);
      expect(useStitchStore.getState().chains).toContainEqual(chain);
    });
  });

  describe('renameChain', () => {
    it('renames chain in state', async () => {
      const stitchDb = await import('@/lib/stitch');
      vi.mocked(stitchDb.updateChain).mockResolvedValue();

      useStitchStore.setState({ chains: [makeChain()] });
      await useStitchStore.getState().renameChain('chain-1', 'Renamed');
      expect(useStitchStore.getState().chains[0].name).toBe('Renamed');
    });
  });

  describe('deleteChain', () => {
    it('removes chain and clears active state when deleted chain is active', async () => {
      const stitchDb = await import('@/lib/stitch');
      vi.mocked(stitchDb.deleteChain).mockResolvedValue();

      useStitchStore.setState({
        chains: [makeChain()],
        activeChainId: 'chain-1',
        nodes: [makeNode()],
        connections: [makeConn()],
      });
      await useStitchStore.getState().deleteChain('chain-1');

      const s = useStitchStore.getState();
      expect(s.chains).toEqual([]);
      expect(s.activeChainId).toBeNull();
      expect(s.nodes).toEqual([]);
      expect(s.connections).toEqual([]);
    });
  });

  describe('addNode', () => {
    it('adds node to state', async () => {
      const stitchDb = await import('@/lib/stitch');
      const node = makeNode();
      vi.mocked(stitchDb.insertNode).mockResolvedValue(node);

      const result = await useStitchStore.getState().addNode({
        chainId: 'chain-1', type: 'request', positionX: 0, positionY: 0, config: {}, label: null,
      });
      expect(result).toEqual(node);
      expect(useStitchStore.getState().nodes).toContainEqual(node);
    });
  });

  describe('updateNode', () => {
    it('updates node position in state', async () => {
      const stitchDb = await import('@/lib/stitch');
      vi.mocked(stitchDb.updateNode).mockResolvedValue();

      useStitchStore.setState({ nodes: [makeNode()] });
      await useStitchStore.getState().updateNode('node-1', { positionX: 100, positionY: 200 });

      const node = useStitchStore.getState().nodes[0];
      expect(node.positionX).toBe(100);
      expect(node.positionY).toBe(200);
    });
  });

  describe('removeNode', () => {
    it('removes node and its connections, clears selection', async () => {
      const stitchDb = await import('@/lib/stitch');
      vi.mocked(stitchDb.deleteNode).mockResolvedValue();

      useStitchStore.setState({
        nodes: [makeNode(), makeNode({ id: 'node-2' })],
        connections: [makeConn()],
        selectedNodeId: 'node-1',
      });
      await useStitchStore.getState().removeNode('node-1');

      const s = useStitchStore.getState();
      expect(s.nodes).toHaveLength(1);
      expect(s.nodes[0].id).toBe('node-2');
      expect(s.connections).toEqual([]);
      expect(s.selectedNodeId).toBeNull();
    });
  });

  describe('selectNode', () => {
    it('sets selected node id', () => {
      useStitchStore.getState().selectNode('node-1');
      expect(useStitchStore.getState().selectedNodeId).toBe('node-1');
    });
  });

  describe('addConnection', () => {
    it('adds connection to state', async () => {
      const stitchDb = await import('@/lib/stitch');
      const conn = makeConn();
      vi.mocked(stitchDb.insertConnection).mockResolvedValue(conn);

      const result = await useStitchStore.getState().addConnection({
        chainId: 'chain-1', sourceNodeId: 'node-1', sourceKey: 'out',
        targetNodeId: 'node-2', targetSlot: 'in',
      });
      expect(result).toEqual(conn);
      expect(useStitchStore.getState().connections).toContainEqual(conn);
    });
  });

  describe('removeConnection', () => {
    it('removes connection from state', async () => {
      const stitchDb = await import('@/lib/stitch');
      vi.mocked(stitchDb.deleteConnection).mockResolvedValue();

      useStitchStore.setState({ connections: [makeConn()] });
      await useStitchStore.getState().removeConnection('conn-1');
      expect(useStitchStore.getState().connections).toEqual([]);
    });
  });

  describe('setExecutionState', () => {
    it('updates execution state', () => {
      useStitchStore.getState().setExecutionState('running');
      expect(useStitchStore.getState().executionState).toBe('running');
    });
  });
});
