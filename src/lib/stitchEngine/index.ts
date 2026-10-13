// Barrel export — preserves the public API of the former stitchEngine.ts
export { topologicalSort } from './topologicalSort';
export { resolveNodeInputs } from './inputResolution';
export { groupByDepth } from './groupByDepth';
export { createExecutionContext, executeChain } from './chainExecutor';
export { analyzeMappingChainRequirements, type MappingChainRequirements } from './mappingChainAnalysis';
export { getUpstreamNodes } from './graphSlicing';
export {
  executeJsonObjectNode,
  executeJsSnippetNode,
  type JsSnippetResult,
  executeRequestNode,
  executeSleepNode,
  executeLogNode,
  type LogNodeResult,
  executeConditionNode,
  computeSkippedNodes,
  executeMergeNode,
  executeMappingEntryNode,
  executeMappingResponseNode,
  executeMappingExitNode,
  executeMappingNode,
  executeMappingRequestSegment,
  type MappingRequestSegmentResult,
  executeLoopNode,
} from './nodeExecutors';
