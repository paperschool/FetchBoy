import type { HttpMethod, BodyMode } from '@/stores/requestStore';

const HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS',
]);

const BODY_MODES: ReadonlySet<string> = new Set([
  'none', 'raw', 'json', 'form-data', 'urlencoded',
]);

const AUTH_TYPES: ReadonlySet<string> = new Set([
  'none', 'bearer', 'basic', 'api-key',
]);

export function isHttpMethod(value: string): value is HttpMethod {
  return HTTP_METHODS.has(value);
}

export function isBodyMode(value: string): value is BodyMode {
  return BODY_MODES.has(value);
}

export function isAuthType(value: string): value is 'none' | 'bearer' | 'basic' | 'api-key' {
  return AUTH_TYPES.has(value);
}

export function isApiKeyIn(value: string): value is 'header' | 'query' {
  return value === 'header' || value === 'query';
}
