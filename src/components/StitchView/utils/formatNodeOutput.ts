/**
 * Format a node's execution output as a JSON string for Monaco preview display.
 * The output shape is already type-specific from the execution engine.
 */
export function formatNodeOutput(output: unknown): string {
  if (output === undefined || output === null) return '';
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}
