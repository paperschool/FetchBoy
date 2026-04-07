import type { StitchNode, StitchConnection, ExecutionContext, ExecutionCallbacks } from '@/types/stitch';
import { topologicalSort } from './topologicalSort';
import { resolveNodeInputs } from './inputResolution';
import { groupByDepth } from './groupByDepth';
import {
  executeJsonObjectNode,
  executeJsSnippetNode,
  executeRequestNode,
  executeSleepNode,
  executeConditionNode,
  computeSkippedNodes,
  executeMergeNode,
  executeMappingNode,
  executeMappingEntryNode,
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

export async function executeChain(
  nodes: StitchNode[],
  connections: StitchConnection[],
  envVariables: Record<string, string>,
  callbacks: ExecutionCallbacks,
  cancelledRef: { current: boolean },
): Promise<ExecutionContext> {
  const ctx = createExecutionContext();

  const topLevelNodes = nodes.filter((n) => n.parentNodeId === null);
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

        if (isParallel) {
          ctx.nodeOutputs[node.id] = null;
          ctx.logs.push({
            nodeId: node.id, nodeLabel: node.label ?? node.type, nodeType: node.type,
            status: 'error', timestamp: Date.now() - ctx.startTime, durationMs, error: message, parallel: true,
          });
          callbacks.onError(node.id, message);
        } else {
          ctx.status = 'error';
          ctx.error = { nodeId: node.id, message };
          ctx.currentNodeId = null;
          ctx.logs.push({
            nodeId: node.id, nodeLabel: node.label ?? node.type, nodeType: node.type,
            status: 'error', timestamp: Date.now() - ctx.startTime, durationMs, error: message,
          });
          callbacks.onError(node.id, message);
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
