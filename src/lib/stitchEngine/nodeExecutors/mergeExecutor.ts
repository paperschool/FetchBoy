import type { StitchNode, StitchConnection, ExecutionContext, MergeNodeConfig } from '@/types/stitch';

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
