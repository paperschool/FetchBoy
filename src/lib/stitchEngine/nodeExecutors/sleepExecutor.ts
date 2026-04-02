import type { StitchNode, ExecutionCallbacks, SleepNodeConfig } from '@/types/stitch';

export async function executeSleepNode(
  node: StitchNode,
  input: Record<string, unknown>,
  callbacks: Pick<ExecutionCallbacks, 'onSleepStart'>,
  cancelledRef: { current: boolean },
): Promise<Record<string, unknown>> {
  const config = node.config as unknown as SleepNodeConfig;

  const durationMs =
    config.mode === 'random'
      ? Math.floor(Math.random() * ((config.maxMs ?? 2000) - (config.minMs ?? 500) + 1)) + (config.minMs ?? 500)
      : config.durationMs ?? 1000;

  callbacks.onSleepStart(node.id, durationMs);

  await new Promise<void>((resolve) => setTimeout(resolve, durationMs));

  if (cancelledRef.current) {
    throw new Error('Execution cancelled');
  }

  return { ...input, _delayMs: durationMs };
}
