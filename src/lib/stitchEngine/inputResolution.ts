import type { StitchConnection, ExecutionContext } from '@/types/stitch';

export function resolveNodeInputs(
  nodeId: string,
  connections: StitchConnection[],
  context: ExecutionContext,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  const incoming = connections.filter((c) => c.targetNodeId === nodeId);

  for (const conn of incoming) {
    const sourceOutput = context.nodeOutputs[conn.sourceNodeId];
    if (sourceOutput === undefined) {
      // Source node was skipped by a condition branch — skip this input
      continue;
    }
    const key = conn.sourceKey;
    // Named target slot — use targetSlot as the input key name when specified
    const targetKey = conn.targetSlot && conn.targetSlot !== 'input' ? conn.targetSlot : null;
    if (key) {
      // Keyed connection — extract a specific key from source output
      let value: unknown;
      if (typeof sourceOutput === 'object' && sourceOutput !== null && !Array.isArray(sourceOutput) && key in sourceOutput) {
        value = (sourceOutput as Record<string, unknown>)[key];
      } else {
        value = undefined;
      }
      inputs[targetKey ?? key] = value;
    } else {
      // Null key (single-port connection) — pass the raw value through
      if (targetKey) {
        inputs[targetKey] = sourceOutput;
      } else if (typeof sourceOutput === 'object' && sourceOutput !== null && !Array.isArray(sourceOutput)) {
        // Object: spread its keys into input
        Object.assign(inputs, sourceOutput);
      } else {
        // Primitive, array, or null: assign as `value`
        inputs.value = sourceOutput;
      }
    }
  }

  return inputs;
}
