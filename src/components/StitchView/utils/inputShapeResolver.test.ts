import { describe, it, expect } from 'vitest';
import { resolveInputShape } from './inputShapeResolver';
import type { StitchConnection } from '@/types/stitch';

const makeConn = (overrides: Partial<StitchConnection> = {}): StitchConnection => ({
  id: 'conn-1',
  chainId: 'chain-1',
  sourceNodeId: 'src-1',
  sourceKey: 'key1',
  targetNodeId: 'target-1',
  targetSlot: 'in',
  createdAt: 'ts',
  ...overrides,
});

describe('resolveInputShape', () => {
  it('returns source keys for connections targeting the node', () => {
    const connections = [
      makeConn({ id: 'c1', sourceKey: 'name', targetNodeId: 'n2' }),
      makeConn({ id: 'c2', sourceKey: 'age', targetNodeId: 'n2' }),
    ];
    const result = resolveInputShape('n2', connections);
    expect(result).toEqual(['name', 'age']);
  });

  it('returns empty array when no connections target the node', () => {
    const connections = [
      makeConn({ id: 'c1', sourceKey: 'name', targetNodeId: 'other' }),
    ];
    const result = resolveInputShape('n2', connections);
    expect(result).toEqual([]);
  });

  it('returns empty array when no connections exist', () => {
    const result = resolveInputShape('n2', []);
    expect(result).toEqual([]);
  });

  it('skips connections with null sourceKey', () => {
    const connections = [
      makeConn({ id: 'c1', sourceKey: null, targetNodeId: 'n2' }),
      makeConn({ id: 'c2', sourceKey: 'valid', targetNodeId: 'n2' }),
    ];
    const result = resolveInputShape('n2', connections);
    expect(result).toEqual(['valid']);
  });

  it('handles multiple source nodes connecting to same target', () => {
    const connections = [
      makeConn({ id: 'c1', sourceNodeId: 'src-a', sourceKey: 'x', targetNodeId: 'n2' }),
      makeConn({ id: 'c2', sourceNodeId: 'src-b', sourceKey: 'y', targetNodeId: 'n2' }),
    ];
    const result = resolveInputShape('n2', connections);
    expect(result).toEqual(['x', 'y']);
  });
});
