import { invoke } from '@tauri-apps/api/core';
import type {
  StitchNode,
  StitchConnection,
  ExecutionContext,
  ExecutionCallbacks,
  SleepNodeConfig,
  RequestNodeConfig,
  StitchKeyValuePair,
} from '@/types/stitch';

// ─── Topological Sort (Kahn's Algorithm) ────────────────────────────────────

export function topologicalSort(
  nodes: StitchNode[],
  connections: StitchConnection[],
): StitchNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    adjacency.get(conn.sourceNodeId)?.push(conn.targetNodeId);
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  // Stable ordering: sort zero-degree nodes by original position
  queue.sort((a, b) => {
    const na = nodeMap.get(a)!;
    const nb = nodeMap.get(b)!;
    return na.positionY - nb.positionY || na.positionX - nb.positionX;
  });

  const sorted: StitchNode[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap.get(id)!);

    const neighbors = adjacency.get(id) ?? [];
    const nextBatch: string[] = [];
    for (const neighbor of neighbors) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) nextBatch.push(neighbor);
    }
    // Stable ordering within each BFS level
    nextBatch.sort((a, b) => {
      const na = nodeMap.get(a)!;
      const nb = nodeMap.get(b)!;
      return na.positionY - nb.positionY || na.positionX - nb.positionX;
    });
    queue.push(...nextBatch);
  }

  if (sorted.length !== nodes.length) {
    const cycleNodeIds = nodes
      .filter((n) => !sorted.some((s) => s.id === n.id))
      .map((n) => n.label ?? n.type);
    throw new Error(`Cycle detected involving nodes: ${cycleNodeIds.join(', ')}`);
  }

  return sorted;
}

// ─── Input Resolution ───────────────────────────────────────────────────────

export function resolveNodeInputs(
  nodeId: string,
  connections: StitchConnection[],
  context: ExecutionContext,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  const incoming = connections.filter((c) => c.targetNodeId === nodeId);

  for (const conn of incoming) {
    const sourceOutput = context.nodeOutputs[conn.sourceNodeId];
    if (!sourceOutput) {
      throw new Error(`Source node ${conn.sourceNodeId} has no output (execution order error)`);
    }
    const key = conn.sourceKey;
    if (key && key in sourceOutput) {
      inputs[key] = sourceOutput[key];
    } else if (key) {
      inputs[key] = undefined;
    } else {
      // No source key — spread all source outputs
      Object.assign(inputs, sourceOutput);
    }
  }

  return inputs;
}

// ─── Node Executors ─────────────────────────────────────────────────────────

export function executeJsonObjectNode(
  node: StitchNode,
): Record<string, unknown> {
  const config = node.config as { json?: string };
  const json = config.json ?? '{}';
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw new Error(`JSON Object node "${node.label ?? node.id}": ${(err as Error).message}`);
  }
}

export function executeJsSnippetNode(
  node: StitchNode,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const config = node.config as { code?: string };
  const code = config.code ?? '';
  try {
    // new Function() is sandboxed from local scope but has access to globals.
    // For a desktop app this is acceptable — the user is running their own code.
    const fn = new Function('input', code);
    const result: unknown = fn(input);
    if (typeof result !== 'object' || result === null || Array.isArray(result)) {
      throw new Error('JS Snippet must return a plain object');
    }
    return result as Record<string, unknown>;
  } catch (err) {
    throw new Error(`JS Snippet node "${node.label ?? node.id}": ${(err as Error).message}`);
  }
}

export async function executeRequestNode(
  node: StitchNode,
  input: Record<string, unknown>,
  envVariables: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = node.config as unknown as RequestNodeConfig;

  const interpolate = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      if (key in input) return String(input[key]);
      if (key in envVariables) return envVariables[key];
      return `{{${key}}}`;
    });

  const mapKvPairs = (pairs: StitchKeyValuePair[]): Array<{ key: string; value: string; enabled: boolean }> =>
    pairs
      .filter((p) => p.enabled)
      .map((p) => ({ key: interpolate(p.key), value: interpolate(p.value), enabled: true }));

  const request = {
    method: config.method ?? 'GET',
    url: interpolate(config.url ?? ''),
    headers: mapKvPairs(config.headers ?? []),
    queryParams: mapKvPairs(config.queryParams ?? []),
    body: { mode: config.bodyType === 'none' ? 'none' : 'raw', raw: interpolate(config.body ?? '') },
    auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' },
    timeoutMs: 30000,
    sslVerify: true,
    requestId: null,
  };

  try {
    const response = await invoke<{
      status: number;
      status_text: string;
      response_time_ms: number;
      response_size_bytes: number;
      body: string;
      headers: Array<{ key: string; value: string }>;
      content_type: string | null;
    }>('send_request', { request });

    if (!response) {
      throw new Error('No response received — is the Tauri backend running?');
    }

    const output: Record<string, unknown> = {
      status: response.status,
      headers: Object.fromEntries(response.headers.map((h) => [h.key, h.value])),
      body: response.body,
    };

    // Spread parsed JSON body keys for downstream access
    try {
      const parsed: unknown = JSON.parse(response.body);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        Object.assign(output, parsed as Record<string, unknown>);
      }
    } catch {
      // Body is not JSON — that's fine
    }

    return output;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request node "${node.label ?? node.id}": ${msg}`);
  }
}

export async function executeSleepNode(
  node: StitchNode,
  input: Record<string, unknown>,
  callbacks: Pick<ExecutionCallbacks, 'onSleepStart'>,
  cancelledRef: { current: boolean },
): Promise<Record<string, unknown>> {
  const config = node.config as unknown as SleepNodeConfig;

  const durationMs =
    config.mode === 'random'
      ? Math.floor(Math.random() * ((config.maxMs ?? 2000) - (config.minMs ?? 500) + 1)) + (config.minMs ?? 500)
      : config.durationMs ?? 1000;

  callbacks.onSleepStart(node.id, durationMs);

  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));

  if (cancelledRef.current) {
    throw new Error('Execution cancelled');
  }

  return { ...input, _delayMs: durationMs };
}

// ─── Chain Execution ────────────────────────────────────────────────────────

export function createExecutionContext(): ExecutionContext {
  return {
    nodeOutputs: {},
    logs: [],
    status: 'running',
    currentNodeId: null,
    error: null,
    startTime: Date.now(),
  };
}

export async function executeChain(
  nodes: StitchNode[],
  connections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
): Promise<ExecutionContext> {
  const ctx = createExecutionContext();

  if (nodes.length === 0) {
    ctx.status = 'completed';
    callbacks.onChainComplete();
    return ctx;
  }

  let sorted: StitchNode[];
  try {
    sorted = topologicalSort(nodes, connections);
  } catch (err) {
    ctx.status = 'error';
    ctx.error = { nodeId: '', message: (err as Error).message };
    callbacks.onError('', (err as Error).message);
    return ctx;
  }

  for (const node of sorted) {
    if (cancelledRef.current) {
      ctx.status = 'cancelled';
      return ctx;
    }

    ctx.currentNodeId = node.id;
    callbacks.onNodeStart(node.id);

    const nodeStart = Date.now();
    try {
      const input = resolveNodeInputs(node.id, connections, ctx);
      let output: Record<string, unknown>;

      switch (node.type) {
        case 'json-object':
          output = executeJsonObjectNode(node);
          break;
        case 'js-snippet':
          output = executeJsSnippetNode(node, input);
          break;
        case 'request':
          output = await executeRequestNode(node, input, envVariables);
          break;
        case 'sleep':
          output = await executeSleepNode(node, input, callbacks, cancelledRef);
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      const durationMs = Date.now() - nodeStart;
      ctx.nodeOutputs[node.id] = output;

      ctx.logs.push({
        nodeId: node.id,
        nodeLabel: node.label ?? node.type,
        nodeType: node.type,
        status: 'completed',
        timestamp: Date.now() - ctx.startTime,
        durationMs,
        input,
        output,
      });

      callbacks.onNodeComplete(node.id, output, durationMs);
    } catch (err) {
      const message = (err as Error).message;
      ctx.status = 'error';
      ctx.error = { nodeId: node.id, message };
      ctx.currentNodeId = null;

      ctx.logs.push({
        nodeId: node.id,
        nodeLabel: node.label ?? node.type,
        nodeType: node.type,
        status: 'error',
        timestamp: Date.now() - ctx.startTime,
        durationMs: Date.now() - nodeStart,
        error: message,
      });

      callbacks.onError(node.id, message);
      return ctx;
    }
  }

  ctx.status = 'completed';
  ctx.currentNodeId = null;
  callbacks.onChainComplete();
  return ctx;
}
