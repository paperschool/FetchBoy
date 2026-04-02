import type { StitchNodeType, StitchNode } from '@/types/stitch';
import {
  DEFAULT_JSON_OBJECT_CONFIG,
  DEFAULT_JS_SNIPPET_CONFIG,
  DEFAULT_REQUEST_NODE_CONFIG,
  DEFAULT_SLEEP_NODE_CONFIG,
  DEFAULT_LOOP_NODE_CONFIG,
  DEFAULT_MERGE_NODE_CONFIG,
  DEFAULT_CONDITION_NODE_CONFIG,
  DEFAULT_MAPPING_CONFIG,
} from '@/types/stitch';

const LABEL_MAP: Record<string, string> = {
  'js-snippet': 'Snippet',
  'json-object': 'JSON',
  sleep: 'Sleep',
  loop: 'Loop',
  request: 'Request',
  merge: 'Merge',
  condition: 'Condition',
  mapping: 'Mapping',
};

/** Get default config for a node type. */
export function getDefaultConfig(type: StitchNodeType): Record<string, unknown> {
  switch (type) {
    case 'json-object': return { ...DEFAULT_JSON_OBJECT_CONFIG };
    case 'js-snippet': return { ...DEFAULT_JS_SNIPPET_CONFIG };
    case 'request': return { ...DEFAULT_REQUEST_NODE_CONFIG };
    case 'sleep': return { ...DEFAULT_SLEEP_NODE_CONFIG };
    case 'loop': return { ...DEFAULT_LOOP_NODE_CONFIG };
    case 'merge': return { ...DEFAULT_MERGE_NODE_CONFIG };
    case 'condition': return { ...DEFAULT_CONDITION_NODE_CONFIG };
    case 'mapping': return { ...DEFAULT_MAPPING_CONFIG };
    default: return {};
  }
}

/** Generate a label for a new node based on type and existing count. */
export function generateNodeLabel(type: StitchNodeType, existingNodes: StitchNode[]): string {
  const count = existingNodes.filter((n) => n.type === type).length;
  return `${LABEL_MAP[type] ?? type} ${count + 1}`;
}
