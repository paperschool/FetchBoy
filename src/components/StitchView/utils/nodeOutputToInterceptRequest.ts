import type { StitchNode } from '@/types/stitch';
import type { InterceptRequest } from '@/stores/interceptStore';

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringRecord(value: unknown): Record<string, string> | undefined {
    if (!isPlainObject(value)) return undefined;
    const entries = Object.entries(value).filter(([, v]) => typeof v === 'string') as [string, string][];
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function formatCookies(output: Record<string, unknown>): string | undefined {
    if (Array.isArray(output.setCookies) && output.setCookies.length > 0) {
        return output.setCookies.filter((c) => typeof c === 'string').join('; ');
    }
    const cookies = asStringRecord(output.cookies);
    if (cookies) {
        return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }
    return undefined;
}

/** Splits an absolute URL into host + path(+query) so the Params tab can parse
 * query params and the header shows the real URL, not a placeholder. */
function splitUrl(url: string): { host: string; path: string } {
    try {
        const parsed = new URL(url);
        return { host: parsed.host, path: `${parsed.pathname}${parsed.search}` };
    } catch {
        return { host: '', path: url };
    }
}

function toBodyString(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (value === undefined) return undefined;
    return JSON.stringify(value, null, 2);
}

/**
 * Adapts a Stitch node's raw execution output (shape varies by node type —
 * request/mapping-exit/mapping-response look like {status, headers, body,
 * ...}; other nodes are arbitrary JSON) into the same `InterceptRequest`
 * shape the Intercept view uses, so the same response viewer can be reused
 * (DRY) instead of building a second body/headers/params renderer.
 */
export function adaptNodeOutputToInterceptRequest(
    node: StitchNode,
    output: unknown,
    timestamp: number,
): InterceptRequest {
    const obj = isPlainObject(output) ? output : {};
    const hasBodyKey = 'body' in obj;
    const bodyValue = hasBodyKey ? obj.body : (Object.keys(obj).length > 0 ? obj : output);

    const responseHeaders = asStringRecord(obj.headers);
    const cookieHeader = formatCookies(obj);
    const mergedResponseHeaders = cookieHeader
        ? { ...(responseHeaders ?? {}), 'set-cookie': cookieHeader }
        : responseHeaders;

    const contentType = typeof obj.bodyContentType === 'string'
        ? obj.bodyContentType
        : (responseHeaders?.['content-type'] ?? responseHeaders?.['Content-Type']);

    const { host, path } = typeof obj.url === 'string' ? splitUrl(obj.url) : { host: node.label ?? node.type, path: '' };

    return {
        id: node.id,
        timestamp,
        method: typeof obj.method === 'string' ? obj.method : node.type.toUpperCase(),
        host,
        path,
        statusCode: typeof obj.status === 'number' ? obj.status : undefined,
        contentType,
        responseBody: toBodyString(bodyValue),
        responseHeaders: mergedResponseHeaders,
        requestHeaders: asStringRecord(obj.requestHeaders),
        requestBody: typeof obj.requestBody === 'string' ? obj.requestBody : undefined,
    };
}

/**
 * Adapts a full mapping chain's execution into a single `InterceptRequest` —
 * request-side fields (method/url/request headers/request body) come from
 * the Entry node's output, response-side fields (status/response headers/
 * body/cookies) come from the terminal node's output. Entry's `headers`/
 * `body` are the real request's, not the response's, so they can't be
 * pulled from the same object the single-node adapter above uses.
 */
export function adaptChainOutputToInterceptRequest(
    terminalOutput: unknown,
    entryOutput: unknown,
    timestamp: number,
): InterceptRequest {
    const term = isPlainObject(terminalOutput) ? terminalOutput : {};
    const entry = isPlainObject(entryOutput) ? entryOutput : {};

    const url = typeof entry.url === 'string' ? entry.url : (typeof term.url === 'string' ? term.url : '');
    const { host, path } = splitUrl(url);

    const responseHeaders = asStringRecord(term.headers);
    const cookieHeader = formatCookies(term);
    const mergedResponseHeaders = cookieHeader
        ? { ...(responseHeaders ?? {}), 'set-cookie': cookieHeader }
        : responseHeaders;
    const contentType = typeof term.bodyContentType === 'string'
        ? term.bodyContentType
        : (responseHeaders?.['content-type'] ?? responseHeaders?.['Content-Type']);

    return {
        id: 'chain-output',
        timestamp,
        method: typeof entry.method === 'string' ? entry.method : 'GET',
        host,
        path,
        statusCode: typeof term.status === 'number' ? term.status : undefined,
        contentType,
        responseBody: toBodyString('body' in term ? term.body : undefined),
        responseHeaders: mergedResponseHeaders,
        requestHeaders: asStringRecord(entry.headers),
        requestBody: toBodyString('body' in entry ? entry.body : undefined),
    };
}

