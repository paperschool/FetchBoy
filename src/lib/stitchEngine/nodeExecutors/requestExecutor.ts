import { invoke } from '@tauri-apps/api/core';
import type { StitchNode, RequestNodeConfig, StitchAuthConfig, StitchKeyValuePair } from '@/types/stitch';

function buildAuthPayload(
  auth: StitchAuthConfig | undefined,
  interpolate: (s: string) => string,
): Record<string, string> {
  if (!auth || auth.type === 'none') {
    return { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' };
  }
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', token: interpolate(auth.token), username: '', password: '', key: '', value: '', in: 'header' };
    case 'basic':
      return { type: 'basic', token: '', username: interpolate(auth.username), password: interpolate(auth.password), key: '', value: '', in: 'header' };
    case 'api-key':
      return { type: 'api-key', token: '', username: '', password: '', key: interpolate(auth.key), value: interpolate(auth.value), in: auth.in };
    default:
      return { type: 'none', token: '', username: '', password: '', key: '', value: '', in: 'header' };
  }
}

export async function executeRequestNode(
  node: StitchNode,
  input: Record<string, unknown>,
  envVariables: Record<string, string>,
): Promise<Record<string, unknown>> {
  const config = node.config as unknown as RequestNodeConfig;

  const interpolate = (str: string): string =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      if (key in input) return String(input[key]);
      if (key in envVariables) return envVariables[key];
      return `{{${key}}}`;
    });

  const mapKvPairs = (pairs: StitchKeyValuePair[]): Array<{ key: string; value: string; enabled: boolean }> =>
    pairs
      .filter((p) => p.enabled)
      .map((p) => ({ key: interpolate(p.key), value: interpolate(p.value), enabled: true }));

  const request = {
    method: config.method ?? 'GET',
    url: interpolate(config.url ?? ''),
    headers: mapKvPairs(config.headers ?? []),
    queryParams: mapKvPairs(config.queryParams ?? []),
    body: { mode: config.bodyType === 'none' ? 'none' : 'raw', raw: interpolate(config.body ?? '') },
    auth: buildAuthPayload(config.auth, interpolate),
    timeoutMs: 30000,
    sslVerify: true,
    requestId: null,
  };

  try {
    const response = await invoke<{
      status: number;
      status_text: string;
      response_time_ms: number;
      response_size_bytes: number;
      body: string;
      headers: Array<{ key: string; value: string }>;
      content_type: string | null;
    }>('send_request', { request });

    if (!response) {
      throw new Error('No response received — is the Tauri backend running?');
    }

    let parsedBody: unknown = response.body;
    try {
      parsedBody = JSON.parse(response.body);
    } catch {
      // Body is not JSON — keep as raw string
    }

    return {
      status: response.status,
      headers: Object.fromEntries(response.headers.map((h) => [h.key, h.value])),
      body: parsedBody,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Request node "${node.label ?? node.id}": ${msg}`);
  }
}
