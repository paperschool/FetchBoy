import { describe, it, expect } from 'vitest';
import { parsePostmanV1, isPostmanV1 } from './postmanV1';

const MINIMAL_V1 = JSON.stringify({
  id: 'col-1',
  name: 'My API',
  order: ['req-1', 'req-2'],
  folders: [],
  requests: [
    {
      id: 'req-1',
      name: 'Get Users',
      method: 'GET',
      url: 'https://api.example.com/users?page=1',
      headers: 'Accept: application/json\nX-Api-Key: secret',
      data: null,
      dataMode: 'params',
    },
    {
      id: 'req-2',
      name: 'Create User',
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: 'Content-Type: application/json',
      dataMode: 'raw',
      rawModeData: '{"name":"test"}',
    },
  ],
});

const WITH_FOLDERS = JSON.stringify({
  id: 'col-1',
  name: 'Grouped API',
  order: ['req-root'],
  folders: [
    { id: 'fold-1', name: 'Auth', order: ['req-login'] },
  ],
  requests: [
    { id: 'req-root', name: 'Health', method: 'GET', url: 'https://api.example.com/health', headers: '' },
    { id: 'req-login', name: 'Login', method: 'POST', url: 'https://api.example.com/login', headers: '', dataMode: 'raw', rawModeData: '{}' },
  ],
});

describe('isPostmanV1', () => {
  it('returns true for v1 format', () => {
    expect(isPostmanV1({ requests: [], name: 'test' })).toBe(true);
  });

  it('returns false for v2.x format', () => {
    expect(isPostmanV1({ info: { name: 'test' }, item: [] })).toBe(false);
  });
});

describe('parsePostmanV1', () => {
  it('parses a minimal v1 collection', () => {
    const result = parsePostmanV1(MINIMAL_V1);
    expect(result.collection.name).toBe('My API');
    expect(result.requests).toHaveLength(2);
    expect(result.requests[0].name).toBe('Get Users');
    expect(result.requests[0].method).toBe('GET');
    expect(result.requests[0].url).toBe('https://api.example.com/users?page=1');
  });

  it('parses newline-separated headers', () => {
    const result = parsePostmanV1(MINIMAL_V1);
    expect(result.requests[0].headers).toEqual([
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'X-Api-Key', value: 'secret', enabled: true },
    ]);
  });

  it('extracts raw body content', () => {
    const result = parsePostmanV1(MINIMAL_V1);
    const post = result.requests.find((r) => r.name === 'Create User');
    expect(post?.body_type).toBe('raw');
    expect(post?.body_content).toBe('{"name":"test"}');
  });

  it('maps folders with request assignment', () => {
    const result = parsePostmanV1(WITH_FOLDERS);
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('Auth');
    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.folder_id).toBe(result.folders[0].id);
    const health = result.requests.find((r) => r.name === 'Health');
    expect(health?.folder_id).toBeNull();
  });

  it('extracts {{variables}} from URLs into an environment', () => {
    const withVars = JSON.stringify({
      name: 'Vars API',
      order: ['r1'],
      requests: [{ id: 'r1', name: 'Test', method: 'GET', url: 'https://{{HOST}}/api?key={{API_KEY}}', headers: '' }],
    });
    const result = parsePostmanV1(withVars);
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0].name).toBe('Vars API Variables');
    expect(result.environments[0].variables.map((v) => v.key)).toEqual(['API_KEY', 'HOST']);
  });

  it('throws on invalid JSON', () => {
    expect(() => parsePostmanV1('not json')).toThrow('Invalid JSON');
  });

  it('throws on missing name', () => {
    expect(() => parsePostmanV1(JSON.stringify({ requests: [{ id: '1' }] }))).toThrow('Missing collection name');
  });

  it('extracts preRequestScript from v1 requests', () => {
    const withScript = JSON.stringify({
      name: 'Script API',
      order: ['r1', 'r2'],
      requests: [
        { id: 'r1', name: 'With Script', method: 'GET', url: 'https://api.example.com', headers: '', preRequestScript: 'console.log("hello");' },
        { id: 'r2', name: 'Without Script', method: 'GET', url: 'https://api.example.com/other', headers: '' },
      ],
    });
    const result = parsePostmanV1(withScript);
    const withScriptReq = result.requests.find((r) => r.name === 'With Script');
    const withoutScriptReq = result.requests.find((r) => r.name === 'Without Script');
    expect(withScriptReq?.pre_request_script).toBe('console.log("hello");');
    expect(withoutScriptReq?.pre_request_script).toBe('');
  });
});
