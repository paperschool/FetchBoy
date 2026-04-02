// Barrel export — preserves the public API of the former stitchEngine.ts
export { topologicalSort } from './topologicalSort';
export { resolveNodeInputs } from './inputResolution';
export { groupByDepth } from './groupByDepth';
export { createExecutionContext, executeChain } from './chainExecutor';
export {
  executeJsonObjectNode,
  executeJsSnippetNode,
  type JsSnippetResult,
  executeRequestNode,
  executeSleepNode,
  executeConditionNode,
  computeSkippedNodes,
  executeMergeNode,
  executeMappingEntryNode,
  executeMappingExitNode,
  executeMappingNode,
  executeLoopNode,
} from './nodeExecutors';
