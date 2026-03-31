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
  MergeNodeConfig,
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
    if (sourceOutput === undefined) {
      // Source node was skipped by a condition branch — skip this input
      continue;
    }
    const key = conn.sourceKey;
    if (key) {
      // Keyed connection — extract a specific key from source output
      if (typeof sourceOutput === 'object' && sourceOutput !== null && !Array.isArray(sourceOutput) && key in sourceOutput) {
        inputs[key] = (sourceOutput as Record<string, unknown>)[key];
      } else {
        inputs[key] = undefined;
      }
    } else {
      // Null key (single-port connection) — pass the raw value through
      if (typeof sourceOutput === 'object' && sourceOutput !== null && !Array.isArray(sourceOutput)) {
        // Object: spread its keys into input
        Object.assign(inputs, sourceOutput);
      } else {
        // Primitive, array, or null: assign as `value`
        inputs.value = sourceOutput;
      }
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
  output: unknown;
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
    // Return the raw value — no wrapping. Objects, arrays, strings, numbers all pass through as-is.
    return { output: result ?? null, consoleLogs: captured };
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

// ─── Condition Node Executor ───────────────────────────────────────────────

export function executeConditionNode(
  node: StitchNode,
  input: Record<string, unknown>,
): { result: boolean; output: Record<string, unknown> } {
  const config = node.config as { expression?: string };
  const expression = config.expression ?? 'true';

  try {
    const fn = new Function('input', `return (${expression})`);
    const result = Boolean(fn(input));
    return { result, output: { ...input, _condition: result } };
  } catch (err) {
    throw new Error(`Condition node "${node.label ?? node.id}": ${(err as Error).message}`);
  }
}

/**
 * Compute the set of node IDs that should be skipped based on condition results.
 * For a condition node with result=true, skip all nodes exclusively reachable
 * from the 'false' port (and vice versa). Nodes reachable from BOTH branches
 * (convergence points) are NOT skipped.
 */
export function computeSkippedNodes(
  conditionNodeId: string,
  conditionResult: boolean,
  connections: StitchConnection[],
  allNodeIds: Set<string>,
): Set<string> {
  const skippedPort = conditionResult ? 'false' : 'true';
  const activePort = conditionResult ? 'true' : 'false';

  // Find direct children of each port
  const skippedRoots = connections
    .filter((c) => c.sourceNodeId === conditionNodeId && c.sourceKey === skippedPort)
    .map((c) => c.targetNodeId);
  const activeRoots = connections
    .filter((c) => c.sourceNodeId === conditionNodeId && c.sourceKey === activePort)
    .map((c) => c.targetNodeId);

  // DFS to find all reachable nodes from a set of roots
  const reachable = (roots: string[]): Set<string> => {
    const visited = new Set<string>();
    const stack = [...roots];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (visited.has(id) || !allNodeIds.has(id)) continue;
      visited.add(id);
      for (const conn of connections) {
        if (conn.sourceNodeId === id) stack.push(conn.targetNodeId);
      }
    }
    return visited;
  };

  const skippedReachable = reachable(skippedRoots);
  const activeReachable = reachable(activeRoots);

  // Nodes reachable from BOTH branches are convergence points — don't skip them
  const skipped = new Set<string>();
  for (const id of skippedReachable) {
    if (!activeReachable.has(id)) {
      skipped.add(id);
    }
  }

  return skipped;
}

// ─── Merge Node Executor ───────────────────────────────────────────────────

export function executeMergeNode(
  node: StitchNode,
  connections: StitchConnection[],
  allNodes: StitchNode[],
  ctx: ExecutionContext,
): Record<string, unknown> {
  const config = node.config as unknown as MergeNodeConfig;
  const keyMode = config.keyMode ?? 'label';
  const incoming = connections.filter((c) => c.targetNodeId === node.id);
  const merged: Record<string, unknown> = {};

  for (const conn of incoming) {
    const sourceNode = allNodes.find((n) => n.id === conn.sourceNodeId);
    const key = keyMode === 'label'
      ? (sourceNode?.label ?? conn.sourceNodeId)
      : conn.sourceNodeId;
    merged[key] = ctx.nodeOutputs[conn.sourceNodeId] ?? null;
  }

  return merged;
}

// ─── Topological Depth Grouping ────────────────────────────────────────────

export function groupByDepth(
  sorted: StitchNode[],
  connections: StitchConnection[],
): StitchNode[][] {
  const depth = new Map<string, number>();

  for (const node of sorted) {
    const incoming = connections.filter((c) => c.targetNodeId === node.id);
    if (incoming.length === 0) {
      depth.set(node.id, 0);
    } else {
      let maxParentDepth = 0;
      for (const conn of incoming) {
        maxParentDepth = Math.max(maxParentDepth, depth.get(conn.sourceNodeId) ?? 0);
      }
      depth.set(node.id, maxParentDepth + 1);
    }
  }

  const groups = new Map<number, StitchNode[]>();
  for (const node of sorted) {
    const d = depth.get(node.id) ?? 0;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d)!.push(node);
  }

  const maxDepth = Math.max(...groups.keys(), 0);
  const result: StitchNode[][] = [];
  for (let d = 0; d <= maxDepth; d++) {
    result.push(groups.get(d) ?? []);
  }
  return result;
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

  const results: unknown[] = [];

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

        callbacks.onNodeStart(childNode.id, loopCtx);
        const childStart = Date.now();

        // First node in chain gets { element, index } plus any connected inputs
        const childInput = resolveNodeInputs(childNode.id, childConnections, iterCtx);
        // Inject element and index for the first node(s) with no incoming connections
        const incomingCount = childConnections.filter((c) => c.targetNodeId === childNode.id).length;
        if (incomingCount === 0) {
          // Always provide `element` (raw item) and `index`
          // If element is an object, also spread its keys for convenience
          childInput.element = element;
          childInput.index = i;
          if (typeof element === 'object' && element !== null && !Array.isArray(element)) {
            Object.assign(childInput, element as Record<string, unknown>);
          }
        }

        let output: unknown;
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

  const depthGroups = groupByDepth(sorted, topLevelConnections);
  const skippedNodeIds = new Set<string>();

  for (const group of depthGroups) {
    if (cancelledRef.current) {
      ctx.status = 'cancelled';
      return ctx;
    }

    const isParallel = group.length > 1;

    const executeOne = async (node: StitchNode): Promise<void> => {
      // Check if this node was skipped by a condition branch
      if (skippedNodeIds.has(node.id)) {
        ctx.logs.push({
          nodeId: node.id,
          nodeLabel: node.label ?? node.type,
          nodeType: node.type,
          status: 'skipped',
          timestamp: Date.now() - ctx.startTime,
        });
        return;
      }

      ctx.currentNodeId = node.id;
      callbacks.onNodeStart(node.id);

      const nodeStart = Date.now();
      try {
        const input = resolveNodeInputs(node.id, topLevelConnections, ctx);
        let output: unknown;
        let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;
        let conditionResult: boolean | undefined;

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
          case 'merge':
            output = executeMergeNode(node, topLevelConnections, topLevelNodes, ctx);
            break;
          case 'condition': {
            const condResult = executeConditionNode(node, input);
            output = condResult.output;
            conditionResult = condResult.result;
            // Compute which downstream nodes to skip
            const toSkip = computeSkippedNodes(node.id, condResult.result, topLevelConnections, topLevelNodeIds);
            for (const id of toSkip) skippedNodeIds.add(id);
            break;
          }
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
          parallel: isParallel || undefined,
          conditionResult,
        });

        callbacks.onNodeComplete(node.id, output, durationMs, undefined, consoleLogs);
      } catch (err) {
        const message = (err as Error).message;
        const durationMs = Date.now() - nodeStart;

        if (isParallel) {
          // In parallel mode: don't halt — store null and log the error
          ctx.nodeOutputs[node.id] = null;
          ctx.logs.push({
            nodeId: node.id,
            nodeLabel: node.label ?? node.type,
            nodeType: node.type,
            status: 'error',
            timestamp: Date.now() - ctx.startTime,
            durationMs,
            error: message,
            parallel: true,
          });
          callbacks.onError(node.id, message);
        } else {
          // Sequential: halt execution
          ctx.status = 'error';
          ctx.error = { nodeId: node.id, message };
          ctx.currentNodeId = null;

          ctx.logs.push({
            nodeId: node.id,
            nodeLabel: node.label ?? node.type,
            nodeType: node.type,
            status: 'error',
            timestamp: Date.now() - ctx.startTime,
            durationMs,
            error: message,
          });

          callbacks.onError(node.id, message);
          throw err; // Re-throw to break out of the depth loop
        }
      }
    };

    if (isParallel) {
      await Promise.all(group.map((node) => executeOne(node)));
    } else {
      try {
        await executeOne(group[0]);
      } catch {
        return ctx; // Error already logged in executeOne
      }
    }
  }

  ctx.status = 'completed';
  ctx.currentNodeId = null;
  callbacks.onChainComplete();
  return ctx;
}
