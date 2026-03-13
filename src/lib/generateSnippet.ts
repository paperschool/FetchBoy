import type { AuthState, BodyMode } from '@/stores/requestStore';

export type SnippetFormat = 'curl' | 'python' | 'javascript' | 'nodejs';

export interface ResolvedRequest {
    method: string;
    url: string;
    headers: Array<{ key: string; value: string; enabled: boolean }>;
    queryParams: Array<{ key: string; value: string; enabled: boolean }>;
    body: { mode: BodyMode; raw: string };
    auth: AuthState;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildResolvedHeaders(req: ResolvedRequest): Array<{ key: string; value: string }> {
    const enabledHeaders = req.headers.filter((h) => h.enabled && h.key);

    const authHeaders: Array<{ key: string; value: string }> = [];

    if (req.auth.type === 'bearer') {
        authHeaders.push({ key: 'Authorization', value: `Bearer ${req.auth.token}` });
    } else if (req.auth.type === 'basic') {
        const encoded = btoa(`${req.auth.username}:${req.auth.password}`);
        authHeaders.push({ key: 'Authorization', value: `Basic ${encoded}` });
    } else if (req.auth.type === 'api-key' && req.auth.in === 'header') {
        authHeaders.push({ key: req.auth.key, value: req.auth.value });
    }

    return [...authHeaders, ...enabledHeaders.map((h) => ({ key: h.key, value: h.value }))];
}

function buildResolvedUrl(req: ResolvedRequest): string {
    const enabledParams = req.queryParams.filter((p) => p.enabled && p.key);
    const authQueryParam =
        req.auth.type === 'api-key' && req.auth.in === 'query'
            ? { key: req.auth.key, value: req.auth.value }
            : null;

    const allParams = authQueryParam ? [...enabledParams, authQueryParam] : enabledParams;

    if (allParams.length === 0) return req.url;

    const qs = allParams
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
        .join('&');

    return req.url.includes('?') ? `${req.url}&${qs}` : `${req.url}?${qs}`;
}

// For Python and axios: URL without query params baked in
function buildBaseUrl(req: ResolvedRequest): string {
    return req.url;
}

function hasBody(req: ResolvedRequest): boolean {
    return req.body.mode !== 'none' && req.body.raw.trim().length > 0;
}

function trimLines(snippet: string): string {
    return snippet
        .split('\n')
        .map((line) => line.trimEnd())
        .join('\n');
}

// ---------------------------------------------------------------------------
// Format generators
// ---------------------------------------------------------------------------

function generateCurl(req: ResolvedRequest): string {
    const resolvedHeaders = buildResolvedHeaders(req);
    const resolvedUrl = buildResolvedUrl(req);
    const body = hasBody(req);

    const lines: string[] = [`curl -X ${req.method} '${resolvedUrl}'`];

    for (const h of resolvedHeaders) {
        lines[lines.length - 1] += ' \\';
        lines.push(`  -H '${h.key}: ${h.value}'`);
    }

    if (body) {
        lines[lines.length - 1] += ' \\';
        lines.push(`  -d '${req.body.raw}'`);
    }

    return trimLines(lines.join('\n'));
}

function generatePython(req: ResolvedRequest): string {
    const resolvedHeaders = buildResolvedHeaders(req);
    const enabledParams = req.queryParams.filter((p) => p.enabled && p.key);
    const baseUrl = buildBaseUrl(req);
    const body = hasBody(req);

    const parts: string[] = ['import requests', ''];
    parts.push(`url = "${baseUrl}"`);

    if (resolvedHeaders.length > 0) {
        const headerLines = resolvedHeaders
            .map((h) => `    "${h.key}": "${h.value}"`)
            .join(',\n');
        parts.push(`headers = {\n${headerLines}\n}`);
    }

    if (enabledParams.length > 0) {
        const paramLines = enabledParams
            .map((p) => `    "${p.key}": "${p.value}"`)
            .join(',\n');
        parts.push(`params = {\n${paramLines}\n}`);
    }

    if (body) {
        parts.push(`data = '${req.body.raw}'`);
    }

    parts.push('');

    const kwargs: string[] = ['url'];
    if (resolvedHeaders.length > 0) kwargs.push('headers=headers');
    if (enabledParams.length > 0) kwargs.push('params=params');
    if (body) kwargs.push('data=data');

    const methodLower = req.method.toLowerCase();
    parts.push(`response = requests.${methodLower}(${kwargs.join(', ')})`);
    parts.push('print(response.json())');

    return trimLines(parts.join('\n'));
}

function generateJavaScript(req: ResolvedRequest): string {
    const resolvedHeaders = buildResolvedHeaders(req);
    const resolvedUrl = buildResolvedUrl(req);
    const body = hasBody(req);

    const optionParts: string[] = [`  method: '${req.method}'`];

    if (resolvedHeaders.length > 0) {
        const headerLines = resolvedHeaders
            .map((h) => `    '${h.key}': '${h.value}'`)
            .join(',\n');
        optionParts.push(`  headers: {\n${headerLines}\n  }`);
    }

    if (body) {
        optionParts.push(`  body: '${req.body.raw}'`);
    }

    const optionsStr = optionParts.join(',\n');
    const lines: string[] = [
        `const response = await fetch('${resolvedUrl}', {`,
        `${optionsStr}`,
        `});`,
        ``,
        `const data = await response.json();`,
        `console.log(data);`,
    ];

    return trimLines(lines.join('\n'));
}

function generateNodejs(req: ResolvedRequest): string {
    const resolvedHeaders = buildResolvedHeaders(req);
    const enabledParams = req.queryParams.filter((p) => p.enabled && p.key);
    const baseUrl = buildBaseUrl(req);
    const body = hasBody(req);

    const methodLower = req.method.toLowerCase();
    const axiosParts: string[] = [`  method: '${methodLower}'`, `  url: '${baseUrl}'`];

    if (resolvedHeaders.length > 0) {
        const headerLines = resolvedHeaders
            .map((h) => `    '${h.key}': '${h.value}'`)
            .join(',\n');
        axiosParts.push(`  headers: {\n${headerLines}\n  }`);
    }

    if (enabledParams.length > 0) {
        const paramLines = enabledParams
            .map((p) => `    ${p.key}: '${p.value}'`)
            .join(',\n');
        axiosParts.push(`  params: {\n${paramLines}\n  }`);
    }

    if (body) {
        axiosParts.push(`  data: '${req.body.raw}'`);
    }

    const axiosStr = axiosParts.join(',\n');
    const lines: string[] = [
        `const axios = require('axios');`,
        ``,
        `const response = await axios({`,
        `${axiosStr}`,
        `});`,
        ``,
        `console.log(response.data);`,
    ];

    return trimLines(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function generateSnippet(format: SnippetFormat, req: ResolvedRequest): string {
    switch (format) {
        case 'curl':
            return generateCurl(req);
        case 'python':
            return generatePython(req);
        case 'javascript':
            return generateJavaScript(req);
        case 'nodejs':
            return generateNodejs(req);
    }
}
