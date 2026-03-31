import type { StitchNode, StitchConnection } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';
import { resolveInputShape } from './inputShapeResolver';

/** Returns the current output keys for any node type. */
export function getNodeOutputKeys(node: StitchNode, connections?: StitchConnection[], nodes?: StitchNode[]): string[] {
  switch (node.type) {
    case 'json-object': {
      const json = (node.config as { json?: string }).json ?? '';
      const result = extractJsonKeys(json);
      return result.error ? [] : result.keys;
    }
    case 'js-snippet': {
      const code = (node.config as { code?: string }).code ?? '';
      const result = extractReturnKeys(code);
      return result.error ? [] : result.keys;
    }
    case 'request':
      return getRequestOutputPorts();
    case 'sleep':
      // Pass-through: forward all incoming connection keys
      return connections ? resolveInputShape(node.id, connections, nodes) : [];
    case 'merge':
      // Merge node output keys are the labels/IDs of connected sources — dynamic at runtime
      return [];
    case 'condition':
      return ['true', 'false'];
    default:
      return [];
  }
}
