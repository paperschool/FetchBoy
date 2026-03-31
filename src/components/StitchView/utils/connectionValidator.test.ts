import { describe, it, expect } from 'vitest';
import { validateConnection } from './connectionValidator';
import type { StitchConnection } from '@/types/stitch';

const makeConn = (overrides: Partial<StitchConnection> = {}): StitchConnection => ({
  id: 'conn-1',
  chainId: 'chain-1',
  sourceNodeId: 'a',
  sourceKey: 'key1',
  targetNodeId: 'b',
  targetSlot: 'input',
  createdAt: 'ts',
  ...overrides,
});

describe('validateConnection', () => {
  it('rejects self-connections', () => {
    const result = validateConnection('a', 'key1', 'a', []);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('itself');
  });

  it('rejects duplicate connections', () => {
    const connections = [makeConn({ sourceNodeId: 'a', sourceKey: 'key1', targetNodeId: 'b' })];
    const result = validateConnection('a', 'key1', 'b', connections);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('already exists');
  });

  it('allows different source key to same target', () => {
    const connections = [makeConn({ sourceNodeId: 'a', sourceKey: 'key1', targetNodeId: 'b' })];
    const result = validateConnection('a', 'key2', 'b', connections);
    expect(result.valid).toBe(true);
  });

  it('rejects cycles: A→B, trying B→A', () => {
    const connections = [makeConn({ sourceNodeId: 'a', sourceKey: 'k', targetNodeId: 'b' })];
    const result = validateConnection('b', 'k2', 'a', connections);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('cycle');
  });

  it('rejects indirect cycles: A→B→C, trying C→A', () => {
    const connections = [
      makeConn({ id: 'c1', sourceNodeId: 'a', sourceKey: 'k', targetNodeId: 'b' }),
      makeConn({ id: 'c2', sourceNodeId: 'b', sourceKey: 'k', targetNodeId: 'c' }),
    ];
    const result = validateConnection('c', 'k', 'a', connections);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('cycle');
  });

  it('allows valid connection', () => {
    const result = validateConnection('a', 'key1', 'b', []);
    expect(result.valid).toBe(true);
  });

  it('allows non-cyclic chains: A→B, C→B (two sources into one target)', () => {
    const connections = [makeConn({ sourceNodeId: 'a', sourceKey: 'k', targetNodeId: 'b' })];
    const result = validateConnection('c', 'k', 'b', connections);
    expect(result.valid).toBe(true);
  });
});
