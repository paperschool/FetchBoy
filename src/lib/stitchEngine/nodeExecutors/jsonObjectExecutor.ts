import type { StitchNode } from '@/types/stitch';

export function executeJsonObjectNode(
  node: StitchNode,
): Record<string, unknown> {
  const config = node.config as { json?: string };
  const json = config.json ?? '{}';
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('JSON must be an object');
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw new Error(`JSON Object node "${node.label ?? node.id}": ${(err as Error).message}`);
  }
}
