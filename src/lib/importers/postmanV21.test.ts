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

const WITH_TEST_SCRIPT = JSON.stringify({
  info: { name: 'WithTest', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
  item: [
    {
      name: 'Get Users',
      request: { method: 'GET', url: 'https://api.example.com/users' },
      event: [
        { listen: 'test', script: { exec: ['pm.test("ok", function () {});', 'console.log("done");'] } },
      ],
    },
  ],
});

describe('parsePostmanV21', () => {
  it('imports a per-request test event into post_response_script, converting pm.test → fb.test (Story 20.9)', () => {
    const result = parsePostmanV21(WITH_TEST_SCRIPT);
    expect(result.requests).toHaveLength(1);
    // pm.test/pm.expect are mechanically converted to fb.test/fb.expect so the
    // imported test actually runs in the post-response sandbox (no bare `pm`).
    expect(result.requests[0].post_response_script).toContain('fb.test');
    expect(result.requests[0].post_response_script).not.toContain('pm.test');
    expect(result.requests[0].post_response_script_enabled).toBe(true);
  });

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

  it('warns about test scripts and extracts variables as environment', () => {
    const json = JSON.stringify({
      info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [],
      event: [{ listen: 'test' }],
      variable: [{ key: 'base_url', value: 'https://api.example.com' }],
    });
    const result = parsePostmanV21(json);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].field).toBe('event');
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0].name).toBe('Test Variables');
    expect(result.environments[0].variables).toEqual([{ key: 'base_url', value: 'https://api.example.com', enabled: true }]);
  });

  it('does not warn about pre-request scripts (they are now supported)', () => {
    const json = JSON.stringify({
      info: { name: 'Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [],
      event: [{ listen: 'prerequest' }],
    });
    const result = parsePostmanV21(json);
    expect(result.warnings).toHaveLength(0);
  });

  it('extracts pre-request scripts from item events', () => {
    const json = JSON.stringify({
      info: { name: 'Scripts Test', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [
        {
          name: 'With Script',
          request: { method: 'GET', url: 'https://api.example.com' },
          event: [{ listen: 'prerequest', script: { exec: ['const a = 1;', 'const b = 2;'], type: 'text/javascript' } }],
        },
        {
          name: 'Without Script',
          request: { method: 'GET', url: 'https://api.example.com/other' },
        },
      ],
    });
    const result = parsePostmanV21(json);
    const withScript = result.requests.find((r) => r.name === 'With Script');
    const withoutScript = result.requests.find((r) => r.name === 'Without Script');
    expect(withScript?.pre_request_script).toBe('const a = 1;\nconst b = 2;');
    expect(withoutScript?.pre_request_script).toBe('');
  });

  it('imports a collection-level pre-request script into the collection global slot (Story rework)', () => {
    const json = JSON.stringify({
      info: { name: 'Auth Coll', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      event: [{ listen: 'prerequest', script: { exec: ['pm.environment.set("t", "x");'] } }],
      item: [
        { name: 'A', request: { method: 'GET', url: 'https://api.example.com/a' } },
        { name: 'B', request: { method: 'GET', url: 'https://api.example.com/b' } },
      ],
    });
    const result = parsePostmanV21(json);
    // Collection-level script → the collection's global slot, not a per-request template.
    expect(result.collection.pre_request_script).toContain('fb.env.set("t", "x")');
    expect(result.collection.pre_request_script_enabled).toBe(true);
    expect(result.requests.every((r) => !r.pre_request_template_id)).toBe(true);
  });

  it('inlines a folder-level pre-request script into each contained request', () => {
    const json = JSON.stringify({
      info: { name: 'Folder Coll', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [{
        name: 'Folder',
        event: [{ listen: 'prerequest', script: { exec: ['pm.environment.set("f", "1");'] } }],
        item: [{
          name: 'Req',
          request: { method: 'GET', url: 'https://api.example.com' },
          event: [{ listen: 'prerequest', script: { exec: ['console.log("own");'] } }],
        }],
      }],
    });
    const result = parsePostmanV21(json);
    const req = result.requests.find((r) => r.name === 'Req');
    expect(req?.pre_request_script).toContain('fb.env.set("f", "1")'); // folder ancestor inlined
    expect(req?.pre_request_script).toContain('console.log("own")');   // own script after it
  });

  it('converts a request-level pm.sendRequest script and flags it for review', () => {
    const json = JSON.stringify({
      info: { name: 'C', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: [{
        name: 'OAuth',
        request: { method: 'GET', url: 'https://api.example.com' },
        event: [{ listen: 'prerequest', script: { exec: ['pm.sendRequest({ url: u }, function (e, r) {});'] } }],
      }],
    });
    const result = parsePostmanV21(json);
    const req = result.requests[0];
    expect(req.pre_request_script).toContain('// ⚠️ Imported from Postman');
    expect(result.warnings.some((w) => w.message.includes('manual review'))).toBe(true);
  });
});
