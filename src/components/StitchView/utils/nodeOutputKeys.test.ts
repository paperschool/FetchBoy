import { describe, it, expect } from 'vitest';
import { getNodeOutputKeys } from './nodeOutputKeys';
import type { StitchNode } from '@/types/stitch';

const makeNode = (type: StitchNode['type'], config: Record<string, unknown> = {}): StitchNode => ({
  id: 'n1', chainId: 'c1', type, positionX: 0, positionY: 0,
  config, label: null, createdAt: 'ts', updatedAt: 'ts',
});

describe('getNodeOutputKeys', () => {
  it('returns JSON keys for json-object node', () => {
    expect(getNodeOutputKeys(makeNode('json-object', { json: '{"a":1,"b":2}' }))).toEqual(['a', 'b']);
  });

  it('returns empty for invalid JSON', () => {
    expect(getNodeOutputKeys(makeNode('json-object', { json: '{bad' }))).toEqual([]);
  });

  it('returns return keys for js-snippet node', () => {
    expect(getNodeOutputKeys(makeNode('js-snippet', { code: 'return { x: 1 }' }))).toEqual(['x']);
  });

  it('returns static ports for request node', () => {
    expect(getNodeOutputKeys(makeNode('request'))).toEqual(['status', 'headers', 'body']);
  });

  it('returns empty for sleep node', () => {
    expect(getNodeOutputKeys(makeNode('sleep'))).toEqual([]);
  });
});
