import type { StitchNode, StitchConnection, ExecutionCallbacks, LoopNodeConfig } from '@/types/stitch';
import { topologicalSort } from '../topologicalSort';
import { resolveNodeInputs } from '../inputResolution';
import { createExecutionContext } from '../chainExecutor';
import { executeJsonObjectNode } from './jsonObjectExecutor';
import { executeJsSnippetNode } from './jsSnippetExecutor';
import { executeRequestNode } from './requestExecutor';
import { executeSleepNode } from './sleepExecutor';

export async function executeLoopNode(
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

  // Resolve the input array
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

  const childNodes = allNodes.filter((n) => n.parentNodeId === loopNode.id);
  const childNodeIds = new Set(childNodes.map((n) => n.id));
  const childConnections = allConnections.filter(
    (c) => childNodeIds.has(c.sourceNodeId) && childNodeIds.has(c.targetNodeId),
  );

  if (childNodes.length === 0) {
    return { results: inputArray };
  }

  let sortedChildren: StitchNode[];
  try {
    sortedChildren = topologicalSort(childNodes, childConnections);
  } catch (err) {
    throw new Error(`Loop node "${loopNode.label ?? loopNode.id}": ${(err as Error).message}`);
  }

  const childSourceIds = new Set(childConnections.map((c) => c.sourceNodeId));
  const terminalNodes = sortedChildren.filter((n) => !childSourceIds.has(n.id));
  const terminalNodeId = terminalNodes.length > 0
    ? terminalNodes[terminalNodes.length - 1].id
    : sortedChildren[sortedChildren.length - 1].id;

  const results: unknown[] = [];

  for (let i = 0; i < inputArray.length; i++) {
    if (cancelledRef.current) break;

    if (i > 0 && delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }

    const element = inputArray[i];

    try {
      const iterCtx = createExecutionContext();
      const loopCtx = { loopNodeId: loopNode.id, iteration: i };

      for (const childNode of sortedChildren) {
        if (cancelledRef.current) break;

        callbacks.onNodeStart(childNode.id, loopCtx);
        const childStart = Date.now();

        const childInput = resolveNodeInputs(childNode.id, childConnections, iterCtx);
        const incomingCount = childConnections.filter((c) => c.targetNodeId === childNode.id).length;
        if (incomingCount === 0) {
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

      results.push(iterCtx.nodeOutputs[terminalNodeId] ?? {});
    } catch {
      results.push({});
    }
  }

  return { results };
}
