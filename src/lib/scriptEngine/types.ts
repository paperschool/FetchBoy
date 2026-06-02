import type { KeyValuePair } from '@/lib/db';

// ─── Script Context & Result ────────────────────────────────────────────────

export interface ScriptContext {
  url: string;
  method: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: string;
  envVars: Record<string, string>;
}

export interface ConsoleLogEntry {
  level: 'log' | 'warn' | 'error';
  args: string;
  timestamp: number;
}

export interface HttpLogEntry {
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

export interface ScriptResult {
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  body: string;
  envMutations: Record<string, string>;
  consoleLogs: ConsoleLogEntry[];
  httpLogs: HttpLogEntry[];
}

export interface ScriptError {
  message: string;
  lineNumber?: number;
  /** Full stack trace from the QuickJS sandbox (script frames), when available. */
  stack?: string;
}

// ─── Post-response Script Context & Result ────────────────────────────────────

export interface ResponseSnapshotForScript {
  status: number;
  headers: Record<string, string>;
  body: string;
  /** Response time in milliseconds. */
  time: number;
}

export interface PostResponseContext {
  response: ResponseSnapshotForScript;
  envVars: Record<string, string>;
}

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface PostResponseResult {
  envMutations: Record<string, string>;
  consoleLogs: ConsoleLogEntry[];
  testResults: TestResult[];
}

// ─── HTTP Sender Callback ───────────────────────────────────────────────────

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Callback that performs the actual HTTP request (delegates to Tauri invoke) */
export type HttpSender = (
  method: string,
  url: string,
  options?: HttpRequestOptions,
) => Promise<HttpResponse>;
