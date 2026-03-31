import type { StitchNode } from '@/types/stitch';
import { extractJsonKeys } from './jsonKeyExtractor';
import { extractReturnKeys } from './jsKeyExtractor';
import { getRequestOutputPorts } from './requestOutputResolver';

/** Returns the current output keys for any node type. */
export function getNodeOutputKeys(node: StitchNode): string[] {
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
      return []; // pass-through, no named output keys
    default:
      return [];
  }
}
