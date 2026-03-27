import { describe, it, expect } from 'vitest';
import { parseInsomniaV4 } from './insomniaV4';

const MINIMAL_EXPORT = JSON.stringify({
  __export_format: 4,
  resources: [
    { _id: 'wrk_1', _type: 'workspace', name: 'My Workspace', parentId: null },
    { _id: 'req_1', _type: 'request', parentId: 'wrk_1', name: 'Get Users', method: 'GET', url: 'https://api.example.com/users', headers: [{ name: 'Accept', value: 'application/json' }] },
  ],
});

const GROUPED_EXPORT = JSON.stringify({
  __export_format: 4,
  resources: [
    { _id: 'wrk_1', _type: 'workspace', name: 'API Tests', parentId: null },
    { _id: 'grp_1', _type: 'request_group', parentId: 'wrk_1', name: 'Auth' },
    { _id: 'req_1', _type: 'request', parentId: 'grp_1', name: 'Login', method: 'POST', url: 'https://api.example.com/login', body: { mimeType: 'application/json', text: '{"user":"test"}' } },
    { _id: 'req_2', _type: 'request', parentId: 'wrk_1', name: 'Health', method: 'GET', url: 'https://api.example.com/health' },
    { _id: 'env_1', _type: 'environment', parentId: 'wrk_1', name: 'Dev' },
  ],
});

describe('parseInsomniaV4', () => {
  it('parses a minimal workspace', () => {
    const result = parseInsomniaV4(MINIMAL_EXPORT);
    expect(result.collection.name).toBe('My Workspace');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].method).toBe('GET');
    expect(result.requests[0].url).toBe('https://api.example.com/users');
    expect(result.requests[0].headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
  });

  it('parses request groups as folders', () => {
    const result = parseInsomniaV4(GROUPED_EXPORT);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('Auth');
    expect(result.requests).toHaveLength(2);
    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.folder_id).toBe(result.folders[0].id);
    const health = result.requests.find((r) => r.name === 'Health');
    expect(health?.folder_id).toBeNull();
  });

  it('maps body with mimeType', () => {
    const result = parseInsomniaV4(GROUPED_EXPORT);
    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.body_type).toBe('json');
    expect(login?.body_content).toBe('{"user":"test"}');
  });

  it('extracts environments with variables', () => {
    const withEnvData = JSON.stringify({
      __export_format: 4,
      resources: [
        { _id: 'wrk_1', _type: 'workspace', name: 'API Tests', parentId: null },
        { _id: 'env_1', _type: 'environment', parentId: 'wrk_1', name: 'Dev', data: { base_url: 'https://dev.api.com', api_key: 'test123' } },
        { _id: 'req_1', _type: 'request', parentId: 'wrk_1', name: 'Health', method: 'GET', url: 'https://api.example.com/health' },
      ],
    });
    const result = parseInsomniaV4(withEnvData);
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0].name).toBe('API Tests - Dev');
    expect(result.environments[0].variables).toHaveLength(2);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseInsomniaV4('not json')).toThrow('Invalid JSON');
  });

  it('throws on missing workspace', () => {
    expect(() => parseInsomniaV4(JSON.stringify({ resources: [{ _id: 'x', _type: 'request' }] }))).toThrow('No workspace found');
  });
});
