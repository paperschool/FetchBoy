import { invoke } from '@tauri-apps/api/core';
import type {
  StitchNode,
  StitchConnection,
  ExecutionContext,
  ExecutionCallbacks,
  SleepNodeConfig,
  RequestNodeConfig,
  StitchAuthConfig,
  StitchKeyValuePair,
  LoopNodeConfig,
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

export interface JsSnippetResult {
  output: Record<string, unknown>;
  consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }>;
}

export function executeJsSnippetNode(
  node: StitchNode,
  input: Record<string, unknown>,
): JsSnippetResult {
  const config = node.config as { code?: string };
  const code = config.code ?? '';
  const captured: Array<{ level: 'log' | 'warn' | 'error'; args: string }> = [];

  // Intercept console during execution
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const capture = (level: 'log' | 'warn' | 'error') => (...args: unknown[]): void => {
    captured.push({ level, args: args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') });
  };
  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');

  try {
    // new Function() is sandboxed from local scope but has access to globals.
    // For a desktop app this is acceptable — the user is running their own code.
    const fn = new Function('input', code);
    const result: unknown = fn(input);
    let output: Record<string, unknown>;
    if (result === undefined || result === null) {
      output = {};
    } else if (typeof result !== 'object' || Array.isArray(result)) {
      output = { value: result };
    } else {
      output = result as Record<string, unknown>;
    }
    return { output, consoleLogs: captured };
  } catch (err) {
    throw new Error(`JS Snippet node "${node.label ?? node.id}": ${(err as Error).message}`);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}

function buildAuthPayload(
  auth: StitchAuthConfig | undefined,
  interpolate: (s: string) => string,
): Record<string, string> {
  if (!auth || auth.type === 'none') {
    return { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' };
  }
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', token: interpolate(auth.token), username: '', password: '', key: '', value: '', in: 'header' };
    case 'basic':
      return { type: 'basic', token: '', username: interpolate(auth.username), password: interpolate(auth.password), key: '', value: '', in: 'header' };
    case 'api-key':
      return { type: 'api-key', token: '', username: '', password: '', key: interpolate(auth.key), value: interpolate(auth.value), in: auth.in };
    default:
      return { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' };
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
    auth: buildAuthPayload(config.auth, interpolate),
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

    // Parse body as JSON when possible, otherwise keep as string
    let parsedBody: unknown = response.body;
    try {
      parsedBody = JSON.parse(response.body);
    } catch {
      // Body is not JSON — keep as raw string
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.map((h) => [h.key, h.value])),
      body: parsedBody,
    };
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

// ─── Loop Node Execution ────────────────────────────────────────────────────

async function executeLoopNode(
  loopNode: StitchNode,
  input: Record<string, unknown>,
  allNodes: StitchNode[],
  allConnections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
): Promise<Record<string, unknown>> {
  const config = loopNode.config as unknown as LoopNodeConfig;
  const delayMs = config.delayMs ?? 100;

  // Resolve the input array — accept array directly or from a key
  let inputArray: unknown[];
  const values = Object.values(input);
  const arrayValue = values.find((v) => Array.isArray(v));
  if (Array.isArray(input)) {
    inputArray = input;
  } else if (arrayValue) {
    inputArray = arrayValue as unknown[];
  } else {
    throw new Error(`Loop node "${loopNode.label ?? loopNode.id}": input must contain an array`);
  }

  // Get child nodes and their connections
  const childNodes = allNodes.filter((n) => n.parentNodeId === loopNode.id);
  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const childConnections = allConnections.filter(
    (c) => childNodeIds.has(c.sourceNodeId) && childNodeIds.has(c.targetNodeId),
  );

  if (childNodes.length === 0) {
    return { results: inputArray };
  }

  // Sort child nodes
  let sortedChildren: StitchNode[];
  try {
    sortedChildren = topologicalSort(childNodes, childConnections);
  } catch (err) {
    throw new Error(`Loop node "${loopNode.label ?? loopNode.id}": ${(err as Error).message}`);
  }

  // Find terminal node (last in sorted order with no outgoing connections in child scope)
  const childSourceIds = new Set(childConnections.map((c) => c.sourceNodeId));
  const terminalNodes = sortedChildren.filter((n) => !childSourceIds.has(n.id));
  const terminalNodeId = terminalNodes.length > 0 ? terminalNodes[terminalNodes.length - 1].id : sortedChildren[sortedChildren.length - 1].id;

  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < inputArray.length; i++) {
    if (cancelledRef.current) break;

    // Delay between iterations (skip first)
    if (i > 0 && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    const element = inputArray[i];

    try {
      // Create a mini execution context for this iteration
      const iterCtx = createExecutionContext();

      const loopCtx = { loopNodeId: loopNode.id, iteration: i };

      for (const childNode of sortedChildren) {
        if (cancelledRef.current) break;

        console.log('[stitch-loop] iter', i, 'node', childNode.label ?? childNode.type, childNode.id.slice(0, 6));
        callbacks.onNodeStart(childNode.id, loopCtx);
        const childStart = Date.now();

        // First node in chain gets { element, index } plus any connected inputs
        const childInput = resolveNodeInputs(childNode.id, childConnections, iterCtx);
        // Inject element and index for the first node(s) with no incoming connections
        const incomingCount = childConnections.filter((c) => c.targetNodeId === childNode.id).length;
        if (incomingCount === 0) {
          Object.assign(childInput, typeof element === 'object' && element !== null ? element : { element }, { index: i });
        }

        let output: Record<string, unknown>;
        let childConsoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;
        switch (childNode.type) {
          case 'json-object':
            output = executeJsonObjectNode(childNode);
            break;
          case 'js-snippet': {
            const jsResult = executeJsSnippetNode(childNode, childInput);
            output = jsResult.output;
            childConsoleLogs = jsResult.consoleLogs.length > 0 ? jsResult.consoleLogs : undefined;
            break;
          }
          case 'request':
            output = await executeRequestNode(childNode, childInput, envVariables);
            break;
          case 'sleep':
            output = await executeSleepNode(childNode, childInput, callbacks, cancelledRef);
            break;
          default:
            throw new Error(`Unsupported node type in loop: ${childNode.type}`);
        }

        iterCtx.nodeOutputs[childNode.id] = output;
        callbacks.onNodeComplete(childNode.id, output, Date.now() - childStart, loopCtx, childConsoleLogs);
      }

      // Collect terminal node output
      results.push(iterCtx.nodeOutputs[terminalNodeId] ?? {});
    } catch {
      // Error in iteration — push empty object and continue
      results.push({});
    }
  }

  return { results };
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

  // Only execute top-level nodes — child nodes (inside loops) are run by their parent loop
  const topLevelNodes = nodes.filter((n) => n.parentNodeId === null);
  // Only include connections between top-level nodes
  const topLevelNodeIds = new Set(topLevelNodes.map((n) => n.id));
  const topLevelConnections = connections.filter(
    (c) => topLevelNodeIds.has(c.sourceNodeId) && topLevelNodeIds.has(c.targetNodeId),
  );

  if (topLevelNodes.length === 0) {
    ctx.status = 'completed';
    callbacks.onChainComplete();
    return ctx;
  }

  let sorted: StitchNode[];
  try {
    sorted = topologicalSort(topLevelNodes, topLevelConnections);
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
      const input = resolveNodeInputs(node.id, topLevelConnections, ctx);
      let output: Record<string, unknown>;
      let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;

      switch (node.type) {
        case 'json-object':
          output = executeJsonObjectNode(node);
          break;
        case 'js-snippet': {
          const jsResult = executeJsSnippetNode(node, input);
          output = jsResult.output;
          consoleLogs = jsResult.consoleLogs.length > 0 ? jsResult.consoleLogs : undefined;
          break;
        }
        case 'request':
          output = await executeRequestNode(node, input, envVariables);
          break;
        case 'sleep':
          output = await executeSleepNode(node, input, callbacks, cancelledRef);
          break;
        case 'loop':
          output = await executeLoopNode(node, input, nodes, connections, envVariables, callbacks, cancelledRef);
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
        consoleLogs,
      });

      callbacks.onNodeComplete(node.id, output, durationMs, undefined, consoleLogs);
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
