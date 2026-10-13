import { describe, it, expect, vi } from 'vitest';
import type { StitchNode, StitchConnection, ExecutionCallbacks } from '@/types/stitch';
import { executeMappingRequestSegment } from './nodeExecutors/mappingExecutor';

function makeNode(overrides: Partial<StitchNode> & { id: string }): StitchNode {
  return {
    chainId: 'chain-1',
    type: 'json-object',
    positionX: 0,
    positionY: 0,
    config: {},
    label: null,
    parentNodeId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function makeConn(overrides: Partial<StitchConnection> & { sourceNodeId: string; targetNodeId: string }): StitchConnection {
  return {
    id: `conn-${overrides.sourceNodeId}-${overrides.targetNodeId}-${overrides.sourceKey ?? 'single'}`,
    chainId: 'chain-1',
    sourceKey: null,
    targetSlot: null,
    createdAt: '',
    ...overrides,
  };
}

function makeCallbacks(): ExecutionCallbacks {
  return {
    onNodeStart: vi.fn(),
    onNodeComplete: vi.fn(),
    onError: vi.fn(),
    onSleepStart: vi.fn(),
    onChainComplete: vi.fn(),
  };
}

const mapNode = makeNode({ id: 'map', type: 'mapping', config: { urlPattern: '/test', matchType: 'exact' } });
const entryNode = makeNode({ id: 'entry', type: 'mapping-entry', config: { isEntryNode: true } });
const responseNode = makeNode({ id: 'response', type: 'mapping-response', config: { isResponseNode: true } });
const realRequest = { method: 'POST', url: 'https://api.example.com/test', headers: { 'content-type': 'application/json' }, body: { id: '9' } };

describe('executeMappingRequestSegment', () => {
  it('returns the real request untouched when nothing is wired into Response', async () => {
    const nodes = [mapNode, entryNode, responseNode];
    const result = await executeMappingRequestSegment(mapNode, realRequest, nodes, [], {}, makeCallbacks(), { current: false });
    expect(result).toEqual(realRequest);
  });

  it('a static JS Snippet wired into Response.url overrides only the url', async () => {
    const nodes = [mapNode, entryNode, responseNode, makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return { url: "https://rewritten.example.com/test" }' } })];
    const conns = [makeConn({ sourceNodeId: 'js', targetNodeId: 'response', targetSlot: 'url' })];
    const result = await executeMappingRequestSegment(mapNode, realRequest, nodes, conns, {}, makeCallbacks(), { current: false });

    expect(result.url).toBe('https://rewritten.example.com/test');
    expect(result.method).toBe(realRequest.method);
    expect(result.headers).toEqual(realRequest.headers);
    expect(result.body).toEqual(realRequest.body);
  });

  it('derives the override from the real request via Entry, since Entry → transform → Response is not a cycle', async () => {
    const nodes = [
      mapNode, entryNode, responseNode,
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return { url: input.headers["content-type"] === "application/json" ? "https://json.example.com" : "https://text.example.com" }' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'entry', targetNodeId: 'js', sourceKey: 'headers' }),
      makeConn({ sourceNodeId: 'js', targetNodeId: 'response', targetSlot: 'url' }),
    ];
    const result = await executeMappingRequestSegment(mapNode, realRequest, nodes, conns, {}, makeCallbacks(), { current: false });
    expect(result.url).toBe('https://json.example.com');
  });

  it('only executes the nodes Response transitively depends on, skipping unrelated nodes', async () => {
    const nodes = [
      mapNode, entryNode, responseNode,
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return { url: "https://rewritten.example.com/test" }' } }),
      makeNode({ id: 'unrelated', type: 'js-snippet', config: { code: 'return { foo: "bar" }' } }),
    ];
    const conns = [makeConn({ sourceNodeId: 'js', targetNodeId: 'response', targetSlot: 'url' })];
    const callbacks = makeCallbacks();
    await executeMappingRequestSegment(mapNode, realRequest, nodes, conns, {}, callbacks, { current: false });

    const startedIds = (callbacks.onNodeStart as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(startedIds.sort()).toEqual(['js', 'response']);
  });

  it('reports an error against the real failing node, not the mapping container', async () => {
    const nodes = [mapNode, entryNode, responseNode, makeNode({ id: 'js', type: 'js-snippet', config: { code: 'throw new Error("boom")' } })];
    const conns = [makeConn({ sourceNodeId: 'js', targetNodeId: 'response', targetSlot: 'url' })];
    const callbacks = makeCallbacks();

    await expect(
      executeMappingRequestSegment(mapNode, realRequest, nodes, conns, {}, callbacks, { current: false }),
    ).rejects.toThrow('boom');
    expect(callbacks.onError).toHaveBeenCalledWith('js', expect.stringContaining('boom'));
  });

  it('falls back to forwarding the real request when Response is missing entirely', async () => {
    const nodes = [mapNode, entryNode];
    const result = await executeMappingRequestSegment(mapNode, realRequest, nodes, [], {}, makeCallbacks(), { current: false });
    expect(result).toEqual(realRequest);
  });
});

