import { describe, it, expect } from 'vitest';
import { parsePostmanV21 } from './postmanV21';

const MINIMAL_COLLECTION = JSON.stringify({
  info: { name: 'Test Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    {
      name: 'Get Users',
      request: {
        method: 'GET',
        url: { raw: 'https://api.example.com/users', query: [{ key: 'page', value: '1' }] },
        header: [{ key: 'Accept', value: 'application/json' }],
      },
    },
  ],
});

const NESTED_COLLECTION = JSON.stringify({
  info: { name: 'Nested', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    {
      name: 'Auth Folder',
      item: [
        { name: 'Login', request: { method: 'POST', url: 'https://api.example.com/login', body: { mode: 'raw', raw: '{"user":"test"}' } } },
      ],
    },
    { name: 'Health', request: { method: 'GET', url: 'https://api.example.com/health' } },
  ],
});

describe('parsePostmanV21', () => {
  it('parses a minimal collection', () => {
    const result = parsePostmanV21(MINIMAL_COLLECTION);
    expect(result.collection.name).toBe('Test Collection');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].method).toBe('GET');
    expect(result.requests[0].url).toBe('https://api.example.com/users');
    expect(result.requests[0].headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
    expect(result.requests[0].query_params).toEqual([{ key: 'page', value: '1', enabled: true }]);
  });

  it('parses nested folders', () => {
    const result = parsePostmanV21(NESTED_COLLECTION);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('Auth Folder');
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0].name).toBe('Login');
    expect(result.requests[0].folder_id).toBe(result.folders[0].id);
    expect(result.requests[1].name).toBe('Health');
    expect(result.requests[1].folder_id).toBeNull();
  });

  it('maps body content', () => {
    const result = parsePostmanV21(NESTED_COLLECTION);
    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.body_content).toBe('{"user":"test"}');
    expect(login?.body_type).toBe('raw');
  });

  it('throws on invalid JSON', () => {
    expect(() => parsePostmanV21('not json')).toThrow('Invalid JSON');
  });

  it('throws on missing collection name', () => {
    expect(() => parsePostmanV21(JSON.stringify({ info: {} }))).toThrow('Missing collection name');
  });

  it('warns about scripts and extracts variables as environment', () => {
    const json = JSON.stringify({
      info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [],
      event: [{ listen: 'prerequest' }],
      variable: [{ key: 'base_url', value: 'https://api.example.com' }],
    });
    const result = parsePostmanV21(json);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].field).toBe('event');
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0].name).toBe('Test Variables');
    expect(result.environments[0].variables).toEqual([{ key: 'base_url', value: 'https://api.example.com', enabled: true }]);
  });
});
