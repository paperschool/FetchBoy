import type { StitchNode } from '@/types/stitch';

export interface LogNodeResult {
    output: Record<string, unknown>;
    consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }>;
}

/** Passes its input through unchanged, logging it to the console and the
 * debug log's console-output section (via consoleLogs) along the way. */
export function executeLogNode(node: StitchNode, input: Record<string, unknown>): LogNodeResult {
    const tag = `[${node.label ?? 'Log'}]`;
    const serialized = JSON.stringify(input, null, 2);

    // eslint-disable-next-line no-console
    console.log(tag, input);

    return {
        output: input,
        consoleLogs: [{ level: 'log', args: `${tag} ${serialized}` }],
    };
}
