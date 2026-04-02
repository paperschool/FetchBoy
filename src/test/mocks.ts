import { vi } from 'vitest';

/** Standard mock for @tauri-apps/api/core invoke */
export function setupTauriMocks(): ReturnType<typeof vi.fn> {
  const mockInvoke = vi.fn().mockResolvedValue(null);
  vi.mock('@tauri-apps/api/core', () => ({
    invoke: (...args: unknown[]) => mockInvoke(...args),
  }));
  return mockInvoke;
}

/** Create a mock HTTP response matching the Rust send_request shape */
export function createMockResponse(overrides?: Partial<{
  status: number;
  status_text: string;
  response_time_ms: number;
  response_size_bytes: number;
  body: string;
  headers: Array<{ key: string; value: string }>;
  content_type: string | null;
}>): Record<string, unknown> {
  return {
    status: 200,
    status_text: 'OK',
    response_time_ms: 42,
    response_size_bytes: 100,
    body: '{"ok":true}',
    headers: [{ key: 'content-type', value: 'application/json' }],
    content_type: 'application/json',
    ...overrides,
  };
}
