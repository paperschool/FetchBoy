import type { StitchNode, StitchConnection } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';
import { resolveInputShape } from './inputShapeResolver';

export const MAPPING_EXIT_INPUT_KEYS = ['status', 'headers', 'body', 'cookies'] as const;

// Canonical layout for the mapping entry/exit pair so corresponding ports
// align vertically across nodes (e.g. entry.cookies → exit.cookies). Entry
// has all 5 (`url` is the request URL output); exit only renders the first
// 4 but leaves slot 4 empty so 0–3 line up with entry's 0–3.
export const MAPPING_PORT_LAYOUT = ['status', 'headers', 'body', 'cookies', 'url'] as const;

/**
 * Returns the horizontal position (as a percentage of node width) for a port
 * with the given key on the given node. Mapping-entry/exit use a shared
 * canonical 5-slot layout; other nodes distribute their keys evenly.
 */
export function getPortLeftPercent(nodeType: string, portKey: string, allKeys: readonly string[]): number {
  if (nodeType === 'mapping-entry' || nodeType === 'mapping-exit') {
    const idx = MAPPING_PORT_LAYOUT.indexOf(portKey as typeof MAPPING_PORT_LAYOUT[number]);
    if (idx >= 0) {
      const count = MAPPING_PORT_LAYOUT.length;
      return 10 + (idx / (count - 1)) * 80;
    }
  }
  const idx = allKeys.indexOf(portKey);
  const count = allKeys.length;
  if (idx < 0 || count === 0) return 50;
  if (count === 1) return 50;
  return 10 + (idx / (count - 1)) * 80;
}

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
      return ['status', 'headers', 'body', 'cookies', 'url'];
    default:
      return [];
  }
}
