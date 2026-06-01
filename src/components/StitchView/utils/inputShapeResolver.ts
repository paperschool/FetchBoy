import type { StitchConnection, StitchNode } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';

/**
 * Resolve the input shape for a node by finding all incoming connections
 * and collecting their sourceKey values. For null sourceKey connections
 * (single-port nodes like JSON Object / JS Snippet), resolves keys from
 * the source node's config when nodes array is provided.
 */
export function resolveInputShape(
  nodeId: string,
  connections: StitchConnection[],
  nodes?: StitchNode[],
): string[] {
  const keys: string[] = [];
  for (const c of connections) {
    if (c.targetNodeId !== nodeId) continue;
    // Resolved input key (targetSlot overrides sourceKey when set).
    const targetKey = c.targetSlot && c.targetSlot !== 'input' ? c.targetSlot : null;
    if (c.sourceKey !== null) {
      keys.push(targetKey ?? c.sourceKey);
    } else if (nodes) {
      // Null sourceKey — resolve keys from the source node's output shape.
      // If targetSlot is set, the whole spread lands under that single key.
      if (targetKey) {
        keys.push(targetKey);
      } else {
        const sourceNode = nodes.find((n) => n.id === c.sourceNodeId);
        if (sourceNode) keys.push(...getOutputKeysForNode(sourceNode, connections));
      }
    }
  }
  return keys;
}

/** Extract output keys for a node based on its type and config. */
function getOutputKeysForNode(node: StitchNode, connections: StitchConnection[]): string[] {
  if (node.type === 'json-object') {
    const jsonStr = (node.config as { json?: string }).json ?? '';
    const result = extractJsonKeys(jsonStr);
    return result.keys;
  }
  if (node.type === 'js-snippet') {
    const code = (node.config as { code?: string }).code ?? '';
    const result = extractReturnKeys(code);
    return result.keys;
  }
  if (node.type === 'request') {
    return [...getRequestOutputPorts()];
  }
  if (node.type === 'sleep') {
    // Sleep passes through its inputs
    return resolveInputShape(node.id, connections);
  }
  return [];
}
