import type { StitchNode, StitchConnection } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';
import { resolveInputShape } from './inputShapeResolver';

export const MAPPING_EXIT_INPUT_KEYS = ['status', 'headers', 'body', 'cookies'] as const;

// Response is where the (possibly request-modified) call is actually fired —
// its input ports are the outbound request shape (defaulting to the real
// captured request), not the reply. `status` has no input port since it only
// exists on the reply side; override the final status by rewiring Exit's
// status input directly instead.
export const MAPPING_RESPONSE_INPUT_KEYS = ['method', 'headers', 'body', 'cookies', 'url'] as const;

// Canonical layout shared by entry/response/exit so corresponding ports align
// vertically (e.g. entry.cookies → response.cookies → exit.cookies). `status`
// is response/exit-only (a request has no status) — reserving it as a fixed
// slot keeps the shared columns aligned across all three even though Entry
// doesn't render it.
export const MAPPING_PORT_LAYOUT = ['method', 'status', 'headers', 'body', 'cookies', 'url'] as const;

/**
 * Returns the horizontal position (as a percentage of node width) for a port
 * with the given key on the given node. Mapping-entry/response/exit use a
 * shared canonical layout; other nodes distribute their keys evenly.
 */
export function getPortLeftPercent(nodeType: string, portKey: string, allKeys: readonly string[]): number {
  if (nodeType === 'mapping-entry' || nodeType === 'mapping-response' || nodeType === 'mapping-exit') {
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
  // Response overrides everything except status (see MAPPING_RESPONSE_INPUT_KEYS).
  if (node.type === 'mapping-response') return [...MAPPING_RESPONSE_INPUT_KEYS];
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
    case 'log':
      // Pass-through: forward all incoming connection keys
      return connections ? resolveInputShape(node.id, connections, nodes) : [];
    case 'merge':
      // Merge node output keys are the labels/IDs of connected sources — dynamic at runtime
      return [];
    case 'condition':
      return ['true', 'false'];
    case 'mapping-entry':
      return ['method', 'headers', 'cookies', 'body', 'url'];
    case 'mapping-response':
      return ['status', 'headers', 'cookies', 'body', 'url'];
    default:
      return [];
  }
}
