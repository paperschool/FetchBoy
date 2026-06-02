import { FB_HTTP_METHODS } from './constants';

/**
 * Single source of truth for the FetchBoy script API typings shown as Monaco
 * IntelliSense (Story 20.6). The shapes here MUST mirror the runtime QuickJS
 * bridges in `fbApiBridge.ts` / `fbHttpBridge.ts`. `fbApiTypes.test.ts` asserts
 * every runtime bridge member appears below so the two cannot silently drift.
 *
 * Note: `console` is NOT declared here — Monaco's built-in lib already provides
 * `console.log/warn/error`, and re-declaring it would conflict. The bridge's
 * console support is therefore covered by the editor's standard typings.
 */

/** Runtime members that must be documented in the d.ts (drift-guard surface). */
export const FB_ENV_MEMBERS = ['get', 'set'] as const;
export const FB_REQUEST_MEMBERS = ['url', 'method', 'headers', 'queryParams', 'body'] as const;
export const FB_UTILS_MEMBERS = [
    'uuid', 'timestamp', 'timestampMs', 'base64Encode', 'base64Decode', 'sha256', 'hmacSha256',
] as const;

const httpMethodSignatures = FB_HTTP_METHODS.map(
    (m) =>
        `    /** ${m.toUpperCase()} request. Returns the response status, headers and body. */\n` +
        `    ${m}(url: string, opts?: FbHttpOptions): Promise<FbHttpResponse>;`,
).join('\n');

/** Interface declarations shared by every stage variant. */
const SHARED_INTERFACES = `
interface FbKeyValue { key: string; value: string; enabled: boolean }
interface FbHttpOptions { headers?: Record<string, string>; body?: string }
interface FbHttpResponse { status: number; headers: Record<string, string>; body: string }

interface FbEnv {
  /** Read an environment variable (undefined if unset). */
  get(key: string): string | undefined;
  /** Write an environment variable. Persisted to the active environment. */
  set(key: string, value: string): void;
}

interface FbRequest {
  /** The request URL (read / write). */
  url: string;
  /** The HTTP method (read-only). */
  readonly method: string;
  /** Request headers (read / write). */
  headers: FbKeyValue[];
  /** Query parameters (read / write). */
  queryParams: FbKeyValue[];
  /** The raw request body string (read / write). */
  body: string;
}

interface FbHttp {
${httpMethodSignatures}
}

interface FbResponse {
  /** HTTP status code (read-only). */
  readonly status: number;
  /** Response headers (read-only). */
  readonly headers: Record<string, string>;
  /** Response body string (read-only). */
  readonly body: string;
  /** Response time in milliseconds (read-only). */
  readonly time: number;
}

interface FbExpectation {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(sub: unknown): void;
  toBeGreaterThan(n: number): void;
}

interface FbUtils {
  /** UUID v4. */
  uuid(): string;
  /** Current Unix time in seconds. */
  timestamp(): number;
  /** Current Unix time in milliseconds. */
  timestampMs(): number;
  /** Base-64 encode a string. */
  base64Encode(s: string): string;
  /** Base-64 decode a string. */
  base64Decode(s: string): string;
  /** SHA-256 hex digest. */
  sha256(s: string): string;
  /** HMAC-SHA-256 hex digest. */
  hmacSha256(key: string, s: string): string;
}
`;

// fb members, grouped so each stage advertises only what its runtime sandbox
// actually injects (injectFbApi vs injectFbPostResponseApi in fbApiBridge.ts).
const FB_COMMON_MEMBERS = `  /** Environment variable access. */
  env: FbEnv;
  /** Utility helpers (hashing, encoding, ids, time). */
  utils: FbUtils;`;
const FB_PRE_MEMBERS = `  /** The request being sent (read / write before send). */
  request: FbRequest;
  /** Make HTTP sub-requests from inside the script. */
  http: FbHttp;`;
const FB_POST_MEMBERS = `  /** The response that was received (read-only). */
  response: FbResponse;
  /** Register a named test; assertion failures are recorded, not thrown. */
  test(name: string, fn: () => void): void;
  /** Assertion helper for use inside fb.test. */
  expect(actual: unknown): FbExpectation;`;

const buildDts = (members: string): string =>
    `${SHARED_INTERFACES}\ninterface Fb {\n${members}\n}\n\n// Also available: console.log / console.warn / console.error.\ndeclare const fb: Fb;\n`;

/** Pre-request stage: fb.env / fb.request / fb.http / fb.utils. */
export const FB_API_DTS_PRE = buildDts(`${FB_COMMON_MEMBERS}\n${FB_PRE_MEMBERS}`);
/** Post-response stage: fb.env / fb.response / fb.test / fb.expect / fb.utils. */
export const FB_API_DTS_POST = buildDts(`${FB_COMMON_MEMBERS}\n${FB_POST_MEMBERS}`);
/** Combined surface — used where the stage is ambiguous (e.g. template editing). */
export const FB_API_DTS = buildDts(`${FB_COMMON_MEMBERS}\n${FB_PRE_MEMBERS}\n${FB_POST_MEMBERS}`);
