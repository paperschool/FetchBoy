import type { StitchNode, StitchConnection, ExecutionContext, ExecutionCallbacks } from '@/types/stitch';
import { topologicalSort } from './topologicalSort';
import { resolveNodeInputs } from './inputResolution';
import { groupByDepth } from './groupByDepth';
import {
  executeJsonObjectNode,
  executeJsSnippetNode,
  executeRequestNode,
  executeSleepNode,
  executeLogNode,
  executeConditionNode,
  computeSkippedNodes,
  executeMergeNode,
  executeMappingNode,
  executeMappingEntryNode,
  executeMappingResponseNode,
  executeMappingExitNode,
  executeLoopNode,
} from './nodeExecutors';

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

/**
 * Nodes physically parented under a mapping container, Entry/Response/Exit
 * themselves (which in practice are usually created top-level too — see
 * executeMappingNode's child-discovery comment — so parenting alone can't
 * identify them), plus anything reachable *forward* through connections
 * from them — even if added later via the toolbar as a top-level sibling
 * instead of being properly parented (e.g. a Snippet/Sleep node wired only
 * through Entry/Response) — are all logically internal to the mapping's own
 * traversal. Without excluding them here, they'd ALSO look like independent
 * top-level roots below and run a second time, in parallel with and
 * unsynchronized from the mapping's internal execution (their real inputs
 * come from Entry/Response, which aren't top-level, so this second run sees
 * empty input and races ahead with nothing to wait on — e.g. a Sleep node
 * appearing to fire before the rest of the chain). Nodes that merely feed
 * INTO the mapping container itself (e.g. a JSON node simulating a captured
 * request for manual testing) aren't reachable from Entry/Response, so they
 * correctly remain independent top-level roots.
 */
function findMappingInternalNodeIds(mappingContainer: StitchNode, nodes: StitchNode[], connections: StitchConnection[]): Set<string> {
  const isMappingOwned = (n: StitchNode): boolean =>
    n.parentNodeId === mappingContainer.id ||
    n.type === 'mapping-entry' || n.type === 'mapping-response' || n.type === 'mapping-exit';
  const internalIds = new Set(nodes.filter(isMappingOwned).map((n) => n.id));
  let frontier = [...internalIds];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const c of connections) {
        if (c.sourceNodeId === id && !internalIds.has(c.targetNodeId)) {
          internalIds.add(c.targetNodeId);
          next.push(c.targetNodeId);
        }
      }
    }
    frontier = next;
  }
  return internalIds;
}

export async function executeChain(
  nodes: StitchNode[],
  connections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
): Promise<ExecutionContext> {
  const ctx = createExecutionContext();

  const mappingContainer = nodes.find((n) => n.type === 'mapping');
  const mappingInternalIds = mappingContainer ? findMappingInternalNodeIds(mappingContainer, nodes, connections) : null;
  const topLevelNodes = mappingContainer
    ? nodes.filter((n) => n.id === mappingContainer.id || (n.parentNodeId === null && !mappingInternalIds!.has(n.id)))
    : nodes.filter((n) => n.parentNodeId === null);
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
          case 'log': {
            const logResult = executeLogNode(node, input);
            output = logResult.output;
            consoleLogs = logResult.consoleLogs;
            break;
          }
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
            const toSkip = computeSkippedNodes(node.id, condResult.result, topLevelConnections, topLevelNodeIds);
            for (const id of toSkip) skippedNodeIds.add(id);
            break;
          }
          case 'mapping':
            output = await executeMappingNode(node, input, nodes, connections, envVariables, callbacks, cancelledRef);
            break;
          case 'mapping-entry':
            output = executeMappingEntryNode(node, input);
            break;
          case 'mapping-response':
            output = executeMappingResponseNode(node, input);
            break;
          case 'mapping-exit':
            output = executeMappingExitNode(node, input);
            break;
          case 'fetch-terminal':
            output = { complete: true, ...(input as object) };
            break;
          default:
            throw new Error(`Unknown node type: ${node.type}`);
        }

        const durationMs = Date.now() - nodeStart;
        ctx.nodeOutputs[node.id] = output;

        ctx.logs.push({
          nodeId: node.id, nodeLabel: node.label ?? node.type, nodeType: node.type,
          status: 'completed', timestamp: Date.now() - ctx.startTime, durationMs,
          input, output, consoleLogs, parallel: isParallel || undefined, conditionResult,
        });

        callbacks.onNodeComplete(node.id, output, durationMs, undefined, consoleLogs);
      } catch (err) {
        const message = (err as Error).message;
        const durationMs = Date.now() - nodeStart;
        // A mapping node's child already reported this against itself (see
        // mappingExecutor.ts) — reporting it again here would misattribute
        // it to the mapping container instead of the real failing child.
        const alreadyReported = (err as Error & { stitchErrorReported?: boolean }).stitchErrorReported === true;

        if (isParallel) {
          ctx.nodeOutputs[node.id] = null;
          if (!alreadyReported) {
            ctx.logs.push({
              nodeId: node.id, nodeLabel: node.label ?? node.type, nodeType: node.type,
              status: 'error', timestamp: Date.now() - ctx.startTime, durationMs, error: message, parallel: true,
            });
            callbacks.onError(node.id, message);
          }
        } else {
          ctx.status = 'error';
          ctx.currentNodeId = null;
          if (!alreadyReported) {
            ctx.error = { nodeId: node.id, message };
            ctx.logs.push({
              nodeId: node.id, nodeLabel: node.label ?? node.type, nodeType: node.type,
              status: 'error', timestamp: Date.now() - ctx.startTime, durationMs, error: message,
            });
            callbacks.onError(node.id, message);
          }
          throw err;
        }
      }
    };

    if (isParallel) {
      await Promise.all(group.map((node) => executeOne(node)));
    } else {
      try {
        await executeOne(group[0]);
      } catch {
        return ctx;
      }
    }
  }

  ctx.status = 'completed';
  ctx.currentNodeId = null;
  callbacks.onChainComplete();
  return ctx;
}
