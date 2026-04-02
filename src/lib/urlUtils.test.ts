import { describe, it, expect } from 'vitest';
import {
  extractErrorReason,
  stripQueryFromUrl,
  parseUrlWithFallback,
  buildUrlFromQueryParams,
  buildRequestedUrlForDisplay,
  areQueryParamsEqual,
  authStateToConfig,
} from './urlUtils';

describe('extractErrorReason', () => {
  it('extracts message from Error', () => {
    expect(extractErrorReason(new Error('fail'))).toBe('fail');
  });

  it('returns string errors directly', () => {
    expect(extractErrorReason('network error')).toBe('network error');
  });

  it('extracts message from object', () => {
    expect(extractErrorReason({ message: 'bad request' })).toBe('bad request');
  });

  it('extracts error field from object', () => {
    expect(extractErrorReason({ error: 'forbidden' })).toBe('forbidden');
  });

  it('returns JSON for unknown objects', () => {
    expect(extractErrorReason({ code: 500 })).toBe('{"code":500}');
  });

  it('returns Unknown error for null/undefined', () => {
    expect(extractErrorReason(null)).toBe('Unknown error');
    expect(extractErrorReason(undefined)).toBe('Unknown error');
  });
});

describe('parseUrlWithFallback', () => {
  it('parses valid URL', () => {
    const url = parseUrlWithFallback('https://example.com/path');
    expect(url?.hostname).toBe('example.com');
  });

  it('adds https:// prefix for bare domains', () => {
    const url = parseUrlWithFallback('example.com/api');
    expect(url?.protocol).toBe('https:');
  });

  it('returns null for empty string', () => {
    expect(parseUrlWithFallback('')).toBeNull();
  });

  it('returns null for invalid URLs with protocol', () => {
    expect(parseUrlWithFallback('ftp://[invalid')).toBeNull();
  });
});

describe('stripQueryFromUrl', () => {
  it('removes query string from valid URL', () => {
    expect(stripQueryFromUrl('https://example.com/path?foo=bar')).toBe('https://example.com/path');
  });

  it('preserves hash fragment', () => {
    expect(stripQueryFromUrl('https://example.com/path?q=1#section')).toBe('https://example.com/path#section');
  });

  it('returns URL unchanged when no query', () => {
    expect(stripQueryFromUrl('https://example.com/path')).toBe('https://example.com/path');
  });

  it('handles unparseable URLs with string fallback', () => {
    const result = stripQueryFromUrl('not-a-url?q=1');
    expect(result).not.toContain('?');
  });
});

describe('buildUrlFromQueryParams', () => {
  it('appends enabled params', () => {
    const result = buildUrlFromQueryParams('https://example.com', [
      { key: 'foo', value: 'bar', enabled: true },
      { key: 'baz', value: 'qux', enabled: true },
    ]);
    expect(result).toContain('foo=bar');
    expect(result).toContain('baz=qux');
  });

  it('skips disabled params', () => {
    const result = buildUrlFromQueryParams('https://example.com', [
      { key: 'foo', value: 'bar', enabled: false },
    ]);
    expect(result).not.toContain('foo');
  });

  it('returns null for invalid URL', () => {
    expect(buildUrlFromQueryParams('', [])).toBeNull();
  });
});

describe('buildRequestedUrlForDisplay', () => {
  it('appends query params and auth', () => {
    const result = buildRequestedUrlForDisplay(
      'https://api.example.com',
      [{ key: 'page', value: '1', enabled: true }],
      { type: 'api-key', key: 'apiKey', value: 'secret', in: 'query' },
    );
    expect(result).toContain('page=1');
    expect(result).toContain('apiKey=secret');
  });

  it('returns baseUrl for invalid URL', () => {
    const result = buildRequestedUrlForDisplay('invalid', [], { type: 'none' });
    expect(result).toBe('invalid');
  });
});

describe('areQueryParamsEqual', () => {
  it('returns true for identical arrays', () => {
    const a = [{ key: 'a', value: '1', enabled: true }];
    const b = [{ key: 'a', value: '1', enabled: true }];
    expect(areQueryParamsEqual(a, b)).toBe(true);
  });

  it('returns false for different lengths', () => {
    expect(areQueryParamsEqual([], [{ key: 'a', value: '1', enabled: true }])).toBe(false);
  });

  it('returns false for different values', () => {
    const a = [{ key: 'a', value: '1', enabled: true }];
    const b = [{ key: 'a', value: '2', enabled: true }];
    expect(areQueryParamsEqual(a, b)).toBe(false);
  });
});

describe('authStateToConfig', () => {
  it('converts bearer auth', () => {
    expect(authStateToConfig({ type: 'bearer', token: 'tk' })).toEqual({ token: 'tk' });
  });

  it('converts basic auth', () => {
    expect(authStateToConfig({ type: 'basic', username: 'u', password: 'p' })).toEqual({ username: 'u', password: 'p' });
  });

  it('converts api-key auth', () => {
    expect(authStateToConfig({ type: 'api-key', key: 'k', value: 'v', in: 'header' })).toEqual({ key: 'k', value: 'v', in: 'header' });
  });

  it('returns empty for none', () => {
    expect(authStateToConfig({ type: 'none' })).toEqual({});
  });
});
