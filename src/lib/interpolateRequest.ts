import type { AuthState } from '@/stores/requestStore';
import { HTTP_PROTOCOL_REGEX } from '@/lib/constants';

type KeyValueRow = { key: string; value: string; enabled: boolean };

/** Interpolate environment variables in all request fields. */
export function interpolateRequestFields(
  applyEnv: (s: string) => string,
  url: string,
  headers: KeyValueRow[],
  queryParams: KeyValueRow[],
  body: { mode: string; raw: string },
  auth: AuthState,
): {
  url: string;
  headers: KeyValueRow[];
  queryParams: KeyValueRow[];
  body: { mode: string; raw: string };
  auth: Record<string, string>;
} {
  const interpolatedUrl = applyEnv(url);
  const sendUrl = HTTP_PROTOCOL_REGEX.test(interpolatedUrl)
    ? interpolatedUrl
    : `https://${interpolatedUrl}`;

  const sendHeaders = headers.map((h) => ({
    ...h,
    value: applyEnv(h.value),
  }));

  const sendQueryParams = queryParams.map((q) => ({
    ...q,
    value: applyEnv(q.value),
  }));

  const sendBody = { ...body, raw: applyEnv(body.raw) };

  const sendAuth = { ...auth } as Record<string, string>;
  for (const key of Object.keys(sendAuth)) {
    if (typeof sendAuth[key] === 'string') {
      sendAuth[key] = applyEnv(sendAuth[key]);
    }
  }

  return { url: sendUrl, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody, auth: sendAuth };
}
