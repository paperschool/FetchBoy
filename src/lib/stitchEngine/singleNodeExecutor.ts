import type { StitchNode, StitchConnection, ExecutionCallbacks } from '@/types/stitch';
import {
  executeJsonObjectNode,
  executeJsSnippetNode,
  executeRequestNode,
  executeConditionNode,
  executeLoopNode,
} from './nodeExecutors';

export interface SingleNodeResult {
  output: unknown;
  consoleLogs?: Array<{ level: 'log' | 'warn' | 'error'; args: string }>;
  conditionResult?: boolean;
  durationMs: number;
}

/**
 * Execute a single node in isolation with provided input.
 * Used for replay — does not cascade to downstream nodes.
 */
export async function executeSingleNode(
  node: StitchNode,
  input: unknown,
  envVariables: Record<string, string>,
  allNodes?: StitchNode[],
  allConnections?: StitchConnection[],
): Promise<SingleNodeResult> {
  const start = Date.now();
  const inputRecord = (input ?? {}) as Record<string, unknown>;
  let output: unknown;
  let consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }> | undefined;
  let conditionResult: boolean | undefined;

  switch (node.type) {
    case 'json-object':
      output = executeJsonObjectNode(node);
      break;
    case 'js-snippet': {
      const jsResult = executeJsSnippetNode(node, inputRecord);
      output = jsResult.output;
      consoleLogs = jsResult.consoleLogs.length > 0 ? jsResult.consoleLogs : undefined;
      break;
    }
    case 'request':
      output = await executeRequestNode(node, inputRecord, envVariables);
      break;
    case 'condition': {
      const condResult = executeConditionNode(node, inputRecord);
      output = condResult.output;
      conditionResult = condResult.result;
      break;
    }
    case 'merge':
      output = input;
      break;
    case 'loop': {
      if (!allNodes || !allConnections) {
        output = input;
        break;
      }
      const cancelledRef = { current: false };
      const noopCallbacks: ExecutionCallbacks = {
        onNodeStart: () => {},
        onNodeComplete: () => {},
        onError: () => {},
        onSleepStart: () => {},
        onChainComplete: () => {},
      };
      output = await executeLoopNode(node, inputRecord, allNodes, allConnections, envVariables, noopCallbacks, cancelledRef);
      break;
    }
    case 'sleep':
      throw new Error('Sleep nodes cannot be replayed');
    case 'fetch-terminal':
      output = { complete: true, ...inputRecord };
      break;
    default:
      output = input;
  }

  return { output, consoleLogs, conditionResult, durationMs: Date.now() - start };
}
