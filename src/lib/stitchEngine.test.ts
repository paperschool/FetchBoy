import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StitchNode, StitchConnection, ExecutionCallbacks } from '@/types/stitch';

const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invokeMock(...args) }));

import {
  topologicalSort,
  resolveNodeInputs,
  createExecutionContext,
  executeJsonObjectNode,
  executeJsSnippetNode,
  executeRequestNode,
  executeSleepNode,
  executeChain,
} from './stitchEngine';

// ─── Helpers ────────────────────────────────────────────────────────────────

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
    id: `conn-${overrides.sourceNodeId}-${overrides.targetNodeId}`,
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

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Topological Sort ───────────────────────────────────────────────────────

describe('topologicalSort', () => {
  it('sorts a linear chain', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 100 }),
      makeNode({ id: 'c', positionY: 200 }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'b' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'c' }),
    ];
    const result = topologicalSort(nodes, conns);
    expect(result.map((n) => n.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts a diamond graph', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 100, positionX: 0 }),
      makeNode({ id: 'c', positionY: 100, positionX: 200 }),
      makeNode({ id: 'd', positionY: 200 }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'b' }),
      makeConn({ sourceNodeId: 'a', targetNodeId: 'c' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'd' }),
      makeConn({ sourceNodeId: 'c', targetNodeId: 'd' }),
    ];
    const result = topologicalSort(nodes, conns);
    expect(result[0].id).toBe('a');
    expect(result[3].id).toBe('d');
    // b and c can be in either order, but b is at positionX=0, c at positionX=200
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('c');
  });

  it('detects cycles', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 100 }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'b' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'a' }),
    ];
    expect(() => topologicalSort(nodes, conns)).toThrow(/Cycle detected/);
  });

  it('handles disconnected nodes', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 100 }),
      makeNode({ id: 'b', positionY: 0 }),
    ];
    const result = topologicalSort(nodes, []);
    // Should sort by position (b is at y=0, a at y=100)
    expect(result.map((n) => n.id)).toEqual(['b', 'a']);
  });
});

// ─── resolveNodeInputs ─────────────────────────────────────────────────────

describe('resolveNodeInputs', () => {
  it('resolves single input with source key', () => {
    const ctx = createExecutionContext();
    ctx.nodeOutputs['src'] = { name: 'Alice', age: 30 };
    const conns = [makeConn({ sourceNodeId: 'src', targetNodeId: 'tgt', sourceKey: 'name' })];
    const result = resolveNodeInputs('tgt', conns, ctx);
    expect(result).toEqual({ name: 'Alice' });
  });

  it('resolves multiple inputs from different sources', () => {
    const ctx = createExecutionContext();
    ctx.nodeOutputs['s1'] = { foo: 1 };
    ctx.nodeOutputs['s2'] = { bar: 2 };
    const conns = [
      makeConn({ sourceNodeId: 's1', targetNodeId: 'tgt', sourceKey: 'foo' }),
      makeConn({ sourceNodeId: 's2', targetNodeId: 'tgt', sourceKey: 'bar' }),
    ];
    const result = resolveNodeInputs('tgt', conns, ctx);
    expect(result).toEqual({ foo: 1, bar: 2 });
  });

  it('throws if source node has no output', () => {
    const ctx = createExecutionContext();
    const conns = [makeConn({ sourceNodeId: 'missing', targetNodeId: 'tgt', sourceKey: 'x' })];
    expect(() => resolveNodeInputs('tgt', conns, ctx)).toThrow(/no output/);
  });
});

// ─── JSON Object Node ───────────────────────────────────────────────────────

describe('executeJsonObjectNode', () => {
  it('parses valid JSON', () => {
    const node = makeNode({ id: 'j', config: { json: '{"a":1,"b":"hello"}' } });
    expect(executeJsonObjectNode(node)).toEqual({ a: 1, b: 'hello' });
  });

  it('throws on invalid JSON', () => {
    const node = makeNode({ id: 'j', config: { json: '{bad' } });
    expect(() => executeJsonObjectNode(node)).toThrow(/JSON Object node/);
  });

  it('throws if JSON is not an object', () => {
    const node = makeNode({ id: 'j', config: { json: '[1,2,3]' } });
    expect(() => executeJsonObjectNode(node)).toThrow(/must be an object/);
  });
});

// ─── JS Snippet Node ───────────────────────────────────────────────────────

describe('executeJsSnippetNode', () => {
  it('returns an object from user code', () => {
    const node = makeNode({
      id: 'js',
      type: 'js-snippet',
      config: { code: 'return { doubled: input.x * 2 }' },
    });
    expect(executeJsSnippetNode(node, { x: 5 })).toEqual({ doubled: 10 });
  });

  it('wraps non-object return in { value }', () => {
    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return 42' } }), {},
    )).toEqual({ value: 42 });

    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return "hello"' } }), {},
    )).toEqual({ value: 'hello' });

    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return [1, 2, 3]' } }), {},
    )).toEqual({ value: [1, 2, 3] });
  });

  it('returns empty object for null/undefined return', () => {
    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: '' } }), {},
    )).toEqual({});
  });

  it('throws on syntax error', () => {
    const node = makeNode({
      id: 'js',
      type: 'js-snippet',
      config: { code: 'return {{{' },
    });
    expect(() => executeJsSnippetNode(node, {})).toThrow(/JS Snippet node/);
  });

  it('throws on runtime error', () => {
    const node = makeNode({
      id: 'js',
      type: 'js-snippet',
      config: { code: 'throw new Error("boom")' },
    });
    expect(() => executeJsSnippetNode(node, {})).toThrow(/boom/);
  });
});

// ─── Request Node ───────────────────────────────────────────────────────────

describe('executeRequestNode', () => {
  it('calls invoke with interpolated values and returns output', async () => {
    invokeMock.mockResolvedValue({
      status: 200,
      status_text: 'OK',
      response_time_ms: 100,
      response_size_bytes: 15,
      body: '{"id":1}',
      headers: [{ key: 'content-type', value: 'application/json' }],
      content_type: 'application/json',
    });

    const node = makeNode({
      id: 'req',
      type: 'request',
      config: {
        method: 'GET',
        url: 'https://api.example.com/{{userId}}',
        headers: [{ key: 'Authorization', value: 'Bearer {{token}}', enabled: true }],
        queryParams: [],
        body: '',
        bodyType: 'none',
      },
    });

    const result = await executeRequestNode(node, { userId: '42' }, { token: 'abc123' });

    expect(invokeMock).toHaveBeenCalledWith('send_request', expect.objectContaining({
      request: expect.objectContaining({
        url: 'https://api.example.com/42',
        headers: [{ key: 'Authorization', value: 'Bearer abc123', enabled: true }],
      }),
    }));

    expect(result.status).toBe(200);
    expect(result.body).toEqual({ id: 1 }); // Parsed JSON body
    expect(result.id).toBeUndefined(); // No longer spread to top level
  });

  it('throws on network error', async () => {
    invokeMock.mockRejectedValue(new Error('Connection refused'));
    const node = makeNode({
      id: 'req',
      type: 'request',
      config: { method: 'GET', url: 'http://bad', headers: [], queryParams: [], body: '', bodyType: 'none' },
    });
    await expect(executeRequestNode(node, {}, {})).rejects.toThrow(/Request node/);
  });
});

// ─── Sleep Node ─────────────────────────────────────────────────────────────

describe('executeSleepNode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('sleeps for fixed duration and passes through input', async () => {
    const callbacks = { onSleepStart: vi.fn() };
    const cancelledRef = { current: false };
    const node = makeNode({
      id: 'sl',
      type: 'sleep',
      config: { mode: 'fixed', durationMs: 100, minMs: 50, maxMs: 200 },
    });

    const promise = executeSleepNode(node, { foo: 'bar' }, callbacks, cancelledRef);
    vi.advanceTimersByTime(100);
    const result = await promise;

    expect(callbacks.onSleepStart).toHaveBeenCalledWith('sl', 100);
    expect(result.foo).toBe('bar');
    expect(result._delayMs).toBe(100);
  });

  it('sleeps for random duration within range', async () => {
    const callbacks = { onSleepStart: vi.fn() };
    const cancelledRef = { current: false };
    const node = makeNode({
      id: 'sl',
      type: 'sleep',
      config: { mode: 'random', durationMs: 100, minMs: 50, maxMs: 200 },
    });

    const promise = executeSleepNode(node, {}, callbacks, cancelledRef);
    vi.advanceTimersByTime(200);
    const result = await promise;

    const delay = result._delayMs as number;
    expect(delay).toBeGreaterThanOrEqual(50);
    expect(delay).toBeLessThanOrEqual(200);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

// ─── executeChain Integration ───────────────────────────────────────────────

describe('executeChain', () => {
  it('executes a simple 2-node chain', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{"x": 10}' } }),
      makeNode({
        id: 'b', positionY: 100, type: 'js-snippet',
        config: { code: 'return { result: input.x + 1 }' },
      }),
    ];
    const conns = [makeConn({ sourceNodeId: 'a', targetNodeId: 'b', sourceKey: 'x' })];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['b']).toEqual({ result: 11 });
    expect(callbacks.onNodeStart).toHaveBeenCalledTimes(2);
    expect(callbacks.onNodeComplete).toHaveBeenCalledTimes(2);
    expect(callbacks.onChainComplete).toHaveBeenCalledTimes(1);
  });

  it('halts on node error', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{bad' } }),
      makeNode({ id: 'b', positionY: 100 }),
    ];
    const conns = [makeConn({ sourceNodeId: 'a', targetNodeId: 'b' })];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('error');
    expect(ctx.error?.nodeId).toBe('a');
    expect(callbacks.onError).toHaveBeenCalledTimes(1);
    expect(callbacks.onChainComplete).not.toHaveBeenCalled();
  });

  it('handles cancellation mid-chain', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{"x":1}' } }),
      makeNode({ id: 'b', positionY: 100, config: { json: '{"y":2}' } }),
    ];
    const conns: StitchConnection[] = [];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    // Cancel after first node
    (callbacks.onNodeComplete as ReturnType<typeof vi.fn>).mockImplementation(() => {
      cancelledRef.current = true;
    });

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('cancelled');
    expect(callbacks.onNodeComplete).toHaveBeenCalledTimes(1);
  });

  it('handles empty chain', async () => {
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };
    const ctx = await executeChain([], [], {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(callbacks.onChainComplete).toHaveBeenCalledTimes(1);
  });

  it('reports cycle error via callbacks', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 100 }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'b' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'a' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('error');
    expect(callbacks.onError).toHaveBeenCalledWith('', expect.stringContaining('Cycle'));
  });

  it('executes a loop node over an array', async () => {
    // JSON node outputs an array, loop node iterates and runs a JS snippet child
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"items": [1, 2, 3]}' } }),
      makeNode({ id: 'loop', positionY: 100, type: 'loop', config: { delayMs: 0 } }),
      makeNode({
        id: 'child-js', positionY: 150, type: 'js-snippet', parentNodeId: 'loop',
        config: { code: 'return { doubled: input.element * 2 }' },
      }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'loop', sourceKey: 'items' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    const loopOutput = ctx.nodeOutputs['loop'];
    expect(loopOutput.results).toEqual([
      { doubled: 2 },
      { doubled: 4 },
      { doubled: 6 },
    ]);
  });

  it('loop node catches errors per iteration', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"items": [1, "bad", 3]}' } }),
      makeNode({ id: 'loop', positionY: 100, type: 'loop', config: { delayMs: 0 } }),
      makeNode({
        id: 'child-js', positionY: 150, type: 'js-snippet', parentNodeId: 'loop',
        config: { code: 'if (typeof input.element !== "number") throw new Error("nope"); return { val: input.element }' },
      }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'loop', sourceKey: 'items' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    const loopOutput = ctx.nodeOutputs['loop'];
    expect(loopOutput.results).toEqual([
      { val: 1 },
      {},  // error iteration → empty object
      { val: 3 },
    ]);
  });

  it('loop node accepts array from JS snippet { value: [...] } output', async () => {
    const nodes = [
      makeNode({
        id: 'js-arr', positionY: 0, type: 'js-snippet',
        config: { code: 'return [10, 20, 30]' },
      }),
      makeNode({ id: 'loop', positionY: 100, type: 'loop', config: { delayMs: 0 } }),
      makeNode({
        id: 'child-js', positionY: 150, type: 'js-snippet', parentNodeId: 'loop',
        config: { code: 'return { half: input.element / 2 }' },
      }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'js-arr', targetNodeId: 'loop' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['loop'].results).toEqual([
      { half: 5 },
      { half: 10 },
      { half: 15 },
    ]);
  });
});
