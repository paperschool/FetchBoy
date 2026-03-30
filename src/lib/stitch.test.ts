import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
  execute: vi.fn(),
  select: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  getDb: vi.fn().mockResolvedValue(mockDb),
}));

describe('stitch lib', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.execute.mockResolvedValue({});
    mockDb.select.mockResolvedValue([]);
  });

  describe('loadChains', () => {
    it('fetches all chains and deserializes them', async () => {
      mockDb.select.mockResolvedValueOnce([
        { id: 'c1', name: 'My Chain', created_at: '2026-01-01', updated_at: '2026-01-01' },
      ]);
      const { loadChains } = await import('./stitch');
      const result = await loadChains();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
      expect(result[0].name).toBe('My Chain');
      expect(result[0].createdAt).toBe('2026-01-01');
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM stitch_chains'),
      );
    });
  });

  describe('loadChainWithNodes', () => {
    it('loads chain, nodes, and connections', async () => {
      mockDb.select
        .mockResolvedValueOnce([
          { id: 'c1', name: 'Chain', created_at: '2026-01-01', updated_at: '2026-01-01' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'n1', chain_id: 'c1', type: 'request', position_x: 10, position_y: 20,
            config: '{"url":"http://test"}', label: 'Node 1', created_at: '2026-01-01', updated_at: '2026-01-01',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 'conn1', chain_id: 'c1', source_node_id: 'n1', source_key: 'out',
            target_node_id: 'n2', target_slot: 'in', created_at: '2026-01-01',
          },
        ]);
      const { loadChainWithNodes } = await import('./stitch');
      const result = await loadChainWithNodes('c1');
      expect(result.chain.id).toBe('c1');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].config).toEqual({ url: 'http://test' });
      expect(result.nodes[0].positionX).toBe(10);
      expect(result.connections).toHaveLength(1);
      expect(result.connections[0].sourceNodeId).toBe('n1');
    });

    it('throws when chain not found', async () => {
      mockDb.select.mockResolvedValueOnce([]);
      const { loadChainWithNodes } = await import('./stitch');
      await expect(loadChainWithNodes('missing')).rejects.toThrow('Chain not found');
    });
  });

  describe('insertChain', () => {
    it('creates a chain and returns it', async () => {
      const { insertChain } = await import('./stitch');
      const result = await insertChain('Test Chain');
      expect(result.name).toBe('Test Chain');
      expect(typeof result.id).toBe('string');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stitch_chains'),
        expect.any(Array),
      );
    });
  });

  describe('updateChain', () => {
    it('updates chain name', async () => {
      const { updateChain } = await import('./stitch');
      await updateChain('c1', { name: 'Renamed' });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE stitch_chains'),
        expect.arrayContaining(['Renamed']),
      );
    });

    it('does nothing when no changes', async () => {
      const { updateChain } = await import('./stitch');
      await updateChain('c1', {});
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe('deleteChain', () => {
    it('deletes chain by id', async () => {
      const { deleteChain } = await import('./stitch');
      await deleteChain('c1');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM stitch_chains'),
        ['c1'],
      );
    });
  });

  describe('insertNode', () => {
    it('creates a node and returns it', async () => {
      const { insertNode } = await import('./stitch');
      const result = await insertNode({
        chainId: 'c1', type: 'request', positionX: 5, positionY: 10,
        config: { url: 'http://test' }, label: 'My Node',
      });
      expect(result.chainId).toBe('c1');
      expect(result.type).toBe('request');
      expect(typeof result.id).toBe('string');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stitch_nodes'),
        expect.any(Array),
      );
    });
  });

  describe('updateNode', () => {
    it('updates node position and config', async () => {
      const { updateNode } = await import('./stitch');
      await updateNode('n1', { positionX: 100, config: { key: 'val' } });
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE stitch_nodes'),
        expect.any(Array),
      );
    });
  });

  describe('deleteNode', () => {
    it('deletes node by id', async () => {
      const { deleteNode } = await import('./stitch');
      await deleteNode('n1');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM stitch_nodes'),
        ['n1'],
      );
    });
  });

  describe('insertConnection', () => {
    it('creates a connection and returns it', async () => {
      const { insertConnection } = await import('./stitch');
      const result = await insertConnection({
        chainId: 'c1', sourceNodeId: 'n1', sourceKey: 'out',
        targetNodeId: 'n2', targetSlot: 'in',
      });
      expect(result.chainId).toBe('c1');
      expect(result.sourceNodeId).toBe('n1');
      expect(typeof result.id).toBe('string');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stitch_connections'),
        expect.any(Array),
      );
    });
  });

  describe('deleteConnection', () => {
    it('deletes connection by id', async () => {
      const { deleteConnection } = await import('./stitch');
      await deleteConnection('conn1');
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM stitch_connections'),
        ['conn1'],
      );
    });
  });
});
