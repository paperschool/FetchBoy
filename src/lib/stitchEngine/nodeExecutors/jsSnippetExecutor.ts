import type { StitchNode } from '@/types/stitch';

export interface JsSnippetResult {
  output: unknown;
  consoleLogs: Array<{ level: 'log' | 'warn' | 'error'; args: string }>;
}

export function executeJsSnippetNode(
  node: StitchNode,
  input: Record<string, unknown>,
): JsSnippetResult {
  const config = node.config as { code?: string };
  const code = config.code ?? '';
  const captured: Array<{ level: 'log' | 'warn' | 'error'; args: string }> = [];

  // Intercept console during execution
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const capture = (level: 'log' | 'warn' | 'error') => (...args: unknown[]): void => {
    captured.push({ level, args: args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') });
  };
  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');

  try {
    // new Function() is sandboxed from local scope but has access to globals.
    // For a desktop app this is acceptable — the user is running their own code.
    const fn = new Function('input', code);
    const result: unknown = fn(input);
    return { output: result ?? null, consoleLogs: captured };
  } catch (err) {
    throw new Error(`JS Snippet node "${node.label ?? node.id}": ${(err as Error).message}`);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
}
