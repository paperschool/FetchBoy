import type { StitchNode, StitchConnection } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';
import { resolveInputShape } from './inputShapeResolver';

export const MAPPING_EXIT_INPUT_KEYS = ['status', 'headers', 'body', 'cookies'] as const;

/** Returns named input port keys for nodes that have them (most nodes just have a single unnamed input slot). */
export function getNodeInputKeys(node: StitchNode): string[] {
  if (node.type === 'mapping-exit') return [...MAPPING_EXIT_INPUT_KEYS];
  if (node.type === 'fetch-terminal') return [];
  return [];
}

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
    case 'mapping-entry':
      return ['status', 'headers', 'body', 'cookies'];
    default:
      return [];
  }
}
