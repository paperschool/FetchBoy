import { describe, it, expect } from 'vitest';
import { getNodeOutputKeys, getNodeInputKeys } from './nodeOutputKeys';
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

  it('returns empty for sleep node with no connections', () => {
    expect(getNodeOutputKeys(makeNode('sleep'))).toEqual([]);
  });

  it('returns input keys for sleep node (pass-through)', () => {
    const connections = [
      { id: 'c1', chainId: 'c', sourceNodeId: 'src', sourceKey: 'name', targetNodeId: 'n1', targetSlot: 'input', createdAt: 'ts' },
      { id: 'c2', chainId: 'c', sourceNodeId: 'src', sourceKey: 'age', targetNodeId: 'n1', targetSlot: 'input', createdAt: 'ts' },
    ];
    expect(getNodeOutputKeys(makeNode('sleep'), connections)).toEqual(['name', 'age']);
  });

  it('returns empty for log node with no connections', () => {
    expect(getNodeOutputKeys(makeNode('log'))).toEqual([]);
  });

  it('returns input keys for log node (pass-through)', () => {
    const connections = [
      { id: 'c1', chainId: 'c', sourceNodeId: 'src', sourceKey: 'name', targetNodeId: 'n1', targetSlot: 'input', createdAt: 'ts' },
      { id: 'c2', chainId: 'c', sourceNodeId: 'src', sourceKey: 'age', targetNodeId: 'n1', targetSlot: 'input', createdAt: 'ts' },
    ];
    expect(getNodeOutputKeys(makeNode('log'), connections)).toEqual(['name', 'age']);
  });
});

describe('getNodeInputKeys', () => {
  it('mapping-response accepts method/headers/body/cookies/url overrides, but not status', () => {
    expect(getNodeInputKeys(makeNode('mapping-response'))).toEqual(['method', 'headers', 'body', 'cookies', 'url']);
  });

  it('mapping-exit accepts status/headers/body/cookies (no url)', () => {
    expect(getNodeInputKeys(makeNode('mapping-exit'))).toEqual(['status', 'headers', 'body', 'cookies']);
  });

  it('mapping-entry has no input ports — it starts the chain', () => {
    expect(getNodeInputKeys(makeNode('mapping-entry'))).toEqual([]);
  });
});
