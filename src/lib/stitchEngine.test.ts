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
  executeMergeNode,
  executeConditionNode,
  executeMappingEntryNode,
  executeMappingExitNode,
  computeSkippedNodes,
  groupByDepth,
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

  it('skips missing source node output (e.g. skipped by condition)', () => {
    const ctx = createExecutionContext();
    const conns = [makeConn({ sourceNodeId: 'missing', targetNodeId: 'tgt', sourceKey: 'x' })];
    const result = resolveNodeInputs('tgt', conns, ctx);
    expect(result).toEqual({});
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
    const result = executeJsSnippetNode(node, { x: 5 });
    expect(result.output).toEqual({ doubled: 10 });
    expect(result.consoleLogs).toEqual([]);
  });

  it('passes through non-object returns as-is', () => {
    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return 42' } }), {},
    ).output).toBe(42);

    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return "hello"' } }), {},
    ).output).toBe('hello');

    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'return [1, 2, 3]' } }), {},
    ).output).toEqual([1, 2, 3]);
  });

  it('returns null for undefined return', () => {
    expect(executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: '' } }), {},
    ).output).toBeNull();
  });

  it('captures console.log/warn/error', () => {
    const result = executeJsSnippetNode(
      makeNode({ id: 'js', type: 'js-snippet', config: { code: 'console.log("hello"); console.warn("careful"); console.error("oops"); return {}' } }), {},
    );
    expect(result.consoleLogs).toEqual([
      { level: 'log', args: 'hello' },
      { level: 'warn', args: 'careful' },
      { level: 'error', args: 'oops' },
    ]);
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

// ─── groupByDepth ──────────────────────────────────────────────────────────

describe('groupByDepth', () => {
  it('groups independent roots at depth 0', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 0, positionX: 200 }),
    ];
    const sorted = topologicalSort(nodes, []);
    const groups = groupByDepth(sorted, []);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  it('places downstream nodes at higher depth', () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0 }),
      makeNode({ id: 'b', positionY: 100 }),
      makeNode({ id: 'c', positionY: 200 }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'c' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'c' }),
    ];
    const sorted = topologicalSort(nodes, conns);
    const groups = groupByDepth(sorted, conns);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((n) => n.id).sort()).toEqual(['a', 'b']);
    expect(groups[1].map((n) => n.id)).toEqual(['c']);
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
    // Nodes must be at different depths (connected) so they execute sequentially
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{"x":1}' } }),
      makeNode({ id: 'b', positionY: 100, type: 'js-snippet', config: { code: 'return { y: 2 }' } }),
    ];
    const conns = [makeConn({ sourceNodeId: 'a', targetNodeId: 'b' })];
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

  it('executes independent branches in parallel via Promise.all', async () => {
    // Two independent JSON nodes at same depth → should both complete
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{"x":1}' } }),
      makeNode({ id: 'b', positionY: 0, positionX: 200, config: { json: '{"y":2}' } }),
    ];
    const conns: StitchConnection[] = [];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['a']).toEqual({ x: 1 });
    expect(ctx.nodeOutputs['b']).toEqual({ y: 2 });
    // Both should have parallel flag in logs
    const completedLogs = ctx.logs.filter((l) => l.status === 'completed');
    expect(completedLogs).toHaveLength(2);
    expect(completedLogs.every((l) => l.parallel === true)).toBe(true);
  });

  it('error in one parallel branch stores null, others continue', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, config: { json: '{bad' } }),
      makeNode({ id: 'b', positionY: 0, positionX: 200, config: { json: '{"y":2}' } }),
    ];
    const conns: StitchConnection[] = [];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['a']).toBeNull();
    expect(ctx.nodeOutputs['b']).toEqual({ y: 2 });
  });

  it('merge node combines inputs from multiple sources', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, label: 'Alpha', config: { json: '{"x":1}' } }),
      makeNode({ id: 'b', positionY: 0, positionX: 200, label: 'Beta', config: { json: '{"y":2}' } }),
      makeNode({ id: 'm', positionY: 200, type: 'merge', label: 'Merge', config: { keyMode: 'label' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'm' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'm' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['m']).toEqual({
      Alpha: { x: 1 },
      Beta: { y: 2 },
    });
  });

  it('merge node uses ID keys when keyMode is id', async () => {
    const nodes = [
      makeNode({ id: 'a', positionY: 0, label: 'Alpha', config: { json: '{"x":1}' } }),
      makeNode({ id: 'm', positionY: 200, type: 'merge', config: { keyMode: 'id' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'a', targetNodeId: 'm' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.nodeOutputs['m']).toEqual({ a: { x: 1 } });
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

  it('condition node routes to true branch and skips false branch', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"status": 200}' } }),
      makeNode({ id: 'cond', positionY: 100, type: 'condition', config: { expression: 'input.status === 200' } }),
      makeNode({ id: 'true-branch', positionY: 200, type: 'js-snippet', config: { code: 'return { ok: true }' } }),
      makeNode({ id: 'false-branch', positionY: 200, positionX: 300, type: 'js-snippet', config: { code: 'return { ok: false }' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'cond' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'true-branch', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'false-branch', sourceKey: 'false' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['true-branch']).toEqual({ ok: true });
    expect(ctx.nodeOutputs['false-branch']).toBeUndefined();
    // false-branch should be logged as skipped
    const skippedLogs = ctx.logs.filter((l) => l.status === 'skipped');
    expect(skippedLogs).toHaveLength(1);
    expect(skippedLogs[0].nodeId).toBe('false-branch');
  });

  it('condition node routes to false branch when condition is falsy', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"status": 404}' } }),
      makeNode({ id: 'cond', positionY: 100, type: 'condition', config: { expression: 'input.status === 200' } }),
      makeNode({ id: 'true-branch', positionY: 200, type: 'js-snippet', config: { code: 'return { ok: true }' } }),
      makeNode({ id: 'false-branch', positionY: 200, positionX: 300, type: 'js-snippet', config: { code: 'return { ok: false }' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'cond' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'true-branch', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'false-branch', sourceKey: 'false' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    expect(ctx.nodeOutputs['false-branch']).toEqual({ ok: false });
    expect(ctx.nodeOutputs['true-branch']).toBeUndefined();
  });

  it('convergence node after condition executes regardless of branch', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"status": 200}' } }),
      makeNode({ id: 'cond', positionY: 100, type: 'condition', config: { expression: 'input.status === 200' } }),
      makeNode({ id: 'true-branch', positionY: 200, type: 'js-snippet', config: { code: 'return { branch: "true" }' } }),
      makeNode({ id: 'false-branch', positionY: 200, positionX: 300, type: 'js-snippet', config: { code: 'return { branch: "false" }' } }),
      makeNode({ id: 'converge', positionY: 300, type: 'merge', label: 'Converge', config: { keyMode: 'label' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'cond' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'true-branch', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'false-branch', sourceKey: 'false' }),
      makeConn({ sourceNodeId: 'true-branch', targetNodeId: 'converge' }),
      makeConn({ sourceNodeId: 'false-branch', targetNodeId: 'converge' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    // Converge node should execute (reachable from both branches)
    expect(ctx.nodeOutputs['converge']).toBeDefined();
  });

  it('chained conditions work correctly', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"x": 5}' } }),
      makeNode({ id: 'cond1', positionY: 100, type: 'condition', config: { expression: 'input.x > 0' } }),
      makeNode({ id: 'cond2', positionY: 200, type: 'condition', config: { expression: 'input.x > 10' } }),
      makeNode({ id: 'big', positionY: 300, type: 'js-snippet', config: { code: 'return { size: "big" }' } }),
      makeNode({ id: 'small', positionY: 300, positionX: 300, type: 'js-snippet', config: { code: 'return { size: "small" }' } }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'cond1' }),
      makeConn({ sourceNodeId: 'cond1', targetNodeId: 'cond2', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond2', targetNodeId: 'big', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond2', targetNodeId: 'small', sourceKey: 'false' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    // x=5, x>0 is true, x>10 is false → small branch taken
    expect(ctx.nodeOutputs['small']).toEqual({ size: 'small' });
    expect(ctx.nodeOutputs['big']).toBeUndefined();
  });
});

// ─── Condition Node Unit Tests ─────────────────────────────────────────────

describe('executeConditionNode', () => {
  it('returns true for truthy expression', () => {
    const node = makeNode({ id: 'c', type: 'condition', config: { expression: 'input.x > 0' } });
    const result = executeConditionNode(node, { x: 5 });
    expect(result.result).toBe(true);
    expect(result.output._condition).toBe(true);
  });

  it('returns false for falsy expression', () => {
    const node = makeNode({ id: 'c', type: 'condition', config: { expression: 'input.x > 10' } });
    const result = executeConditionNode(node, { x: 5 });
    expect(result.result).toBe(false);
  });

  it('throws on expression error', () => {
    const node = makeNode({ id: 'c', type: 'condition', config: { expression: 'input.foo.bar.baz' } });
    expect(() => executeConditionNode(node, {})).toThrow(/Condition node/);
  });
});

describe('computeSkippedNodes', () => {
  it('skips nodes exclusively on the false branch when result is true', () => {
    const conns = [
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'a', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'b', sourceKey: 'false' }),
    ];
    const allIds = new Set(['cond', 'a', 'b']);
    const skipped = computeSkippedNodes('cond', true, conns, allIds);
    expect(skipped.has('b')).toBe(true);
    expect(skipped.has('a')).toBe(false);
  });

  it('does not skip convergence nodes reachable from both branches', () => {
    const conns = [
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'a', sourceKey: 'true' }),
      makeConn({ sourceNodeId: 'cond', targetNodeId: 'b', sourceKey: 'false' }),
      makeConn({ sourceNodeId: 'a', targetNodeId: 'merge' }),
      makeConn({ sourceNodeId: 'b', targetNodeId: 'merge' }),
    ];
    const allIds = new Set(['cond', 'a', 'b', 'merge']);
    const skipped = computeSkippedNodes('cond', true, conns, allIds);
    expect(skipped.has('b')).toBe(true);
    expect(skipped.has('merge')).toBe(false);
  });
});

// ─── Mapping Node Tests ────────────────────────────────────────────────────

describe('executeMappingEntryNode', () => {
  it('passes through status, headers, body from input', () => {
    const node = makeNode({ id: 'e', type: 'mapping-entry', config: { isEntryNode: true } });
    const result = executeMappingEntryNode(node, { status: 404, headers: { 'x-foo': 'bar' }, body: { err: true } });
    expect(result.status).toBe(404);
    expect(result.headers).toEqual({ 'x-foo': 'bar' });
    expect(result.body).toEqual({ err: true });
  });

  it('provides defaults when input is empty', () => {
    const node = makeNode({ id: 'e', type: 'mapping-entry', config: { isEntryNode: true } });
    const result = executeMappingEntryNode(node, {});
    expect(result.status).toBe(200);
    expect(result.headers).toEqual({});
    expect(result.body).toEqual({});
  });
});

describe('executeMappingExitNode', () => {
  it('returns configured response with interpolation', () => {
    const node = makeNode({
      id: 'x', type: 'mapping-exit',
      config: {
        isExitNode: true, status: 201,
        headers: [{ key: 'X-Id', value: '{{id}}' }],
        body: '{"created": "{{name}}"}',
        bodyContentType: 'application/json',
      },
    });
    const result = executeMappingExitNode(node, { id: '42', name: 'test' });
    expect(result.status).toBe(201);
    expect(result.headers).toEqual({ 'X-Id': '42' });
    expect(result.body).toBe('{"created": "test"}');
    expect(result.bodyContentType).toBe('application/json');
  });
});

describe('mapping container execution', () => {
  it('executes a mapping container with entry → js → exit', async () => {
    const nodes = [
      makeNode({ id: 'map', positionY: 0, type: 'mapping', config: { urlPattern: '/api/*', matchType: 'wildcard' } }),
      makeNode({ id: 'entry', positionY: 50, type: 'mapping-entry', parentNodeId: 'map', config: { isEntryNode: true } }),
      makeNode({
        id: 'transform', positionY: 50, positionX: 200, type: 'js-snippet', parentNodeId: 'map',
        config: { code: 'return { message: "Hello " + input.body.name }' },
      }),
      makeNode({
        id: 'exit', positionY: 50, positionX: 400, type: 'mapping-exit', parentNodeId: 'map',
        config: { isExitNode: true, status: 200, headers: [], body: '{{message}}', bodyContentType: 'text/plain' },
      }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'entry', targetNodeId: 'transform' }),
      makeConn({ sourceNodeId: 'transform', targetNodeId: 'exit' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    const output = ctx.nodeOutputs['map'] as Record<string, unknown>;
    expect(output.status).toBe(200);
    expect(output.body).toBe('Hello undefined'); // body.name not set in empty input
    expect(output.bodyContentType).toBe('text/plain');
  });

  it('mapping entry receives input data from parent', async () => {
    const nodes = [
      makeNode({ id: 'data', positionY: 0, config: { json: '{"status": 200, "headers": {}, "body": {"name": "World"}}' } }),
      makeNode({ id: 'map', positionY: 100, type: 'mapping', config: { urlPattern: '/test', matchType: 'exact' } }),
      makeNode({ id: 'entry', positionY: 150, type: 'mapping-entry', parentNodeId: 'map', config: { isEntryNode: true } }),
      makeNode({
        id: 'js', positionY: 150, positionX: 200, type: 'js-snippet', parentNodeId: 'map',
        config: { code: 'return { greeting: "Hi " + input.body.name }' },
      }),
      makeNode({
        id: 'exit', positionY: 150, positionX: 400, type: 'mapping-exit', parentNodeId: 'map',
        config: { isExitNode: true, status: 200, headers: [], body: '{{greeting}}', bodyContentType: 'text/plain' },
      }),
    ];
    const conns = [
      makeConn({ sourceNodeId: 'data', targetNodeId: 'map' }),
      makeConn({ sourceNodeId: 'entry', targetNodeId: 'js' }),
      makeConn({ sourceNodeId: 'js', targetNodeId: 'exit' }),
    ];
    const callbacks = makeCallbacks();
    const cancelledRef = { current: false };

    const ctx = await executeChain(nodes, conns, {}, callbacks, cancelledRef);

    expect(ctx.status).toBe('completed');
    const output = ctx.nodeOutputs['map'] as Record<string, unknown>;
    expect(output.body).toBe('Hi World');
  });
});
