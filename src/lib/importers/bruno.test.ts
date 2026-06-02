import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseBruno, parseBrunoCollection, parseBrunoZip, tokenizeBru, isBrunoJsonExport, isBrunoDirectory, type BrunoSourceFile } from './bruno';

// ─── .bru fixtures ───────────────────────────────────────────────────────────

const LOGIN_BRU = `meta {
  name: Login
  type: http
  seq: 1
}

post {
  url: {{baseUrl}}/auth/login
  body: json
  auth: none
}

headers {
  Content-Type: application/json
  ~Disabled: skip-me
}

params:query {
  verbose: true
}

body:json {
  {
    "username": "{{user}}",
    "password": "{{pass}}"
  }
}
`;

const HEALTH_BRU = `meta {
  name: Health
  type: http
}

get {
  url: {{baseUrl}}/health
}
`;

// ─── JSON export fixture ───────────────────────────────────────────────────────

const JSON_EXPORT = JSON.stringify({
  meta: { name: 'My API', type: 'collection' },
  items: [
    {
      type: 'http',
      name: 'Get Users',
      seq: 1,
      request: {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: [{ name: 'Accept', value: 'application/json', enabled: true }],
        params: [{ name: 'page', value: '1', enabled: true, type: 'query' }],
        body: { mode: 'none' },
      },
    },
    {
      type: 'folder',
      name: 'Auth',
      seq: 2,
      items: [
        {
          type: 'http',
          name: 'Login',
          seq: 1,
          request: {
            url: 'https://api.example.com/login',
            method: 'POST',
            body: { mode: 'json', json: '{"x":1}' },
          },
        },
      ],
    },
  ],
});

describe('tokenizeBru', () => {
  it('splits top-level blocks and preserves nested braces in body', () => {
    const blocks = tokenizeBru(LOGIN_BRU);
    const names = blocks.map((b) => b.name);
    expect(names).toContain('meta');
    expect(names).toContain('post');
    expect(names).toContain('headers');
    expect(names).toContain('params:query');
    expect(names).toContain('body:json');
    const bodyBlock = blocks.find((b) => b.name === 'body:json');
    expect(bodyBlock?.body).toContain('"username"');
    expect(bodyBlock?.body).toContain('}'); // inner closing brace retained
  });
});

describe('parseBrunoCollection (directory path)', () => {
  it('parses .bru requests and reconstructs folder tree from paths', () => {
    const files: BrunoSourceFile[] = [
      { path: 'Health.bru', content: HEALTH_BRU },
      { path: 'Auth/Login.bru', content: LOGIN_BRU },
    ];
    const result = parseBrunoCollection(files, 'My API');
    expect(result.collection.name).toBe('My API');
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('Auth');
    expect(result.requests).toHaveLength(2);

    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.method).toBe('POST');
    expect(login?.url).toBe('{{baseUrl}}/auth/login');
    expect(login?.folder_id).toBe(result.folders[0].id);
    expect(login?.body_type).toBe('json');
    expect(login?.body_content).toContain('"username"');
    // disabled header preserved with enabled=false
    expect(login?.headers).toEqual([
      { key: 'Content-Type', value: 'application/json', enabled: true },
      { key: 'Disabled', value: 'skip-me', enabled: false },
    ]);
    expect(login?.query_params).toEqual([{ key: 'verbose', value: 'true', enabled: true }]);
    // placeholders preserved verbatim
    expect(login?.body_content).toContain('{{user}}');

    const health = result.requests.find((r) => r.name === 'Health');
    expect(health?.folder_id).toBeNull();
    expect(health?.method).toBe('GET');
  });

  it('skips environments/ files and folder.bru metadata', () => {
    const files: BrunoSourceFile[] = [
      { path: 'Health.bru', content: HEALTH_BRU },
      { path: 'environments/Local.bru', content: 'vars {\n  baseUrl: http://localhost\n}\n' },
      { path: 'Auth/folder.bru', content: 'meta {\n  name: Auth\n}\n' },
    ];
    const result = parseBrunoCollection(files, 'X');
    expect(result.requests).toHaveLength(1);
    expect(result.requests[0].name).toBe('Health');
  });

  it('warns and skips malformed .bru without throwing', () => {
    const files: BrunoSourceFile[] = [
      { path: 'Good.bru', content: HEALTH_BRU },
      { path: 'Bad.bru', content: 'this is not a valid bru file {{{' },
    ];
    const result = parseBrunoCollection(files, 'X');
    expect(result.requests).toHaveLength(1);
    expect(result.warnings.some((w) => w.field === 'Bad.bru')).toBe(true);
  });

  it('handles an empty collection', () => {
    const result = parseBrunoCollection([], 'Empty');
    expect(result.requests).toHaveLength(0);
    expect(result.folders).toHaveLength(0);
  });
});

describe('Bruno environments', () => {
  it('extracts environments from environments/*.bru (directory path)', () => {
    const files: BrunoSourceFile[] = [
      { path: 'Health.bru', content: HEALTH_BRU },
      { path: 'environments/Production.bru', content: 'vars {\n  baseUrl: https://api.example.com\n  token: live\n}\n' },
      { path: 'environments/Local.bru', content: 'vars {\n  baseUrl: http://localhost:3000\n}\nvars:secret {\n  apiKey: shh\n}\n' },
    ];
    const result = parseBrunoCollection(files, 'X');
    // alphabetical by filename: Local before Production
    expect(result.environments.map((e) => e.name)).toEqual(['Local', 'Production']);
    const local = result.environments[0];
    expect(local.variables).toContainEqual({ key: 'baseUrl', value: 'http://localhost:3000', enabled: true });
    expect(local.variables).toContainEqual({ key: 'apiKey', value: 'shh', enabled: true, secret: true });
  });

  it('extracts environments from JSON export', () => {
    const json = JSON.stringify({
      meta: { name: 'API', type: 'collection' },
      items: [],
      environments: [
        { name: 'Local', variables: [{ name: 'baseUrl', value: 'http://localhost', enabled: true }, { name: 'key', value: 's', secret: true }] },
      ],
    });
    const result = parseBruno(json);
    expect(result.environments).toHaveLength(1);
    expect(result.environments[0].name).toBe('Local');
    expect(result.environments[0].variables).toContainEqual({ key: 'baseUrl', value: 'http://localhost', enabled: true });
    expect(result.environments[0].variables).toContainEqual({ key: 'key', value: 's', enabled: true, secret: true });
  });

  it('handles a collection with no environments', () => {
    const files: BrunoSourceFile[] = [{ path: 'Health.bru', content: HEALTH_BRU }];
    expect(parseBrunoCollection(files, 'X').environments).toHaveLength(0);
  });

  it('extracts environments nested under subfolders (multi-collection imports)', () => {
    const files: BrunoSourceFile[] = [
      { path: 'environments/Root.bru', content: 'vars {\n  a: 1\n}\n' },
      { path: 'ASOS/environments/Web Stubs.bru', content: 'vars {\n  host: https://asos\n}\n' },
      { path: 'ASOS/Health.bru', content: HEALTH_BRU },
    ];
    const result = parseBrunoCollection(files, 'X');
    expect(result.environments.map((e) => e.name).sort()).toEqual(['ASOS / Web Stubs', 'Root']);
    // The nested env file must NOT leak into requests
    expect(result.requests.map((r) => r.name)).toEqual(['Health']);
    // ...and the env folder must not become a request folder
    expect(result.folders.some((f) => f.name === 'environments')).toBe(false);
  });
});

describe('Bruno auth', () => {
  const BEARER_BRU = `meta {
  name: Bearer Req
  type: http
}
get {
  url: {{base}}/x
  auth: bearer
}
auth:bearer {
  token: {{token}}
}
`;
  const BASIC_BRU = `meta {
  name: Basic Req
  type: http
}
get {
  url: {{base}}/y
  auth: basic
}
auth:basic {
  username: {{user}}
  password: {{pass}}
}
`;
  const APIKEY_BRU = `meta {
  name: ApiKey Req
  type: http
}
get {
  url: {{base}}/z
  auth: apikey
}
auth:apikey {
  key: X-Api-Key
  value: {{apiKey}}
  placement: header
}
`;
  const UNKNOWN_BRU = `meta {
  name: Oauth Req
  type: http
}
get {
  url: {{base}}/o
  auth: oauth2
}
auth:oauth2 {
  accessTokenUrl: https://x/token
}
`;
  const INHERIT_BRU = `meta {
  name: Inherit Req
  type: http
}
get {
  url: {{base}}/i
  auth: inherit
}
`;
  const FOLDER_BRU = `meta {
  name: Secured
}
auth:bearer {
  token: {{folderToken}}
}
`;

  it('maps bearer/basic/apikey/none with {{vars}} preserved', () => {
    const result = parseBrunoCollection([
      { path: 'Bearer.bru', content: BEARER_BRU },
      { path: 'Basic.bru', content: BASIC_BRU },
      { path: 'ApiKey.bru', content: APIKEY_BRU },
      { path: 'Health.bru', content: HEALTH_BRU },
    ], 'X');
    const bearer = result.requests.find((r) => r.name === 'Bearer Req');
    expect(bearer?.auth_type).toBe('bearer');
    expect(bearer?.auth_config).toEqual({ token: '{{token}}' });
    const basic = result.requests.find((r) => r.name === 'Basic Req');
    expect(basic?.auth_type).toBe('basic');
    expect(basic?.auth_config).toEqual({ username: '{{user}}', password: '{{pass}}' });
    const apikey = result.requests.find((r) => r.name === 'ApiKey Req');
    expect(apikey?.auth_type).toBe('api-key');
    expect(apikey?.auth_config).toEqual({ 'X-Api-Key': '{{apiKey}}' });
    const health = result.requests.find((r) => r.name === 'Health');
    expect(health?.auth_type).toBe('none');
  });

  it('warns and falls back to none on unknown auth scheme', () => {
    const result = parseBrunoCollection([{ path: 'Oauth.bru', content: UNKNOWN_BRU }], 'X');
    expect(result.requests[0].auth_type).toBe('none');
    expect(result.warnings.some((w) => w.message.toLowerCase().includes('oauth2'))).toBe(true);
  });

  it('resolves inherit from folder.bru then collection', () => {
    const result = parseBrunoCollection([
      { path: 'Secured/folder.bru', content: FOLDER_BRU },
      { path: 'Secured/Inherit.bru', content: INHERIT_BRU },
    ], 'X');
    const req = result.requests.find((r) => r.name === 'Inherit Req');
    expect(req?.auth_type).toBe('bearer');
    expect(req?.auth_config).toEqual({ token: '{{folderToken}}' });
  });

  it('maps auth from JSON export', () => {
    const json = JSON.stringify({
      meta: { name: 'API', type: 'collection' },
      items: [
        { type: 'http', name: 'B', request: { url: 'x', method: 'GET', auth: { mode: 'bearer', bearer: { token: '{{t}}' } } } },
      ],
    });
    const result = parseBruno(json);
    expect(result.requests[0].auth_type).toBe('bearer');
    expect(result.requests[0].auth_config).toEqual({ token: '{{t}}' });
  });
});

describe('Bruno scripts', () => {
  const SCRIPTED_BRU = `meta {
  name: Scripted
  type: http
}
get {
  url: {{base}}/s
}
script:pre-request {
  bru.setVar("ts", Date.now());
}
script:post-response {
  bru.setVar("token", res.body.token);
}
tests {
  expect(res.status).to.equal(200);
}
`;

  it('imports pre-request + post-response scripts and warns only on the tests block (Story 20.9)', () => {
    const result = parseBrunoCollection([
      { path: 'Scripted.bru', content: SCRIPTED_BRU },
      { path: 'Health.bru', content: HEALTH_BRU },
    ], 'X');
    const scripted = result.requests.find((r) => r.name === 'Scripted');
    expect(scripted?.pre_request_script).toBe('bru.setVar("ts", Date.now());');
    expect(scripted?.pre_request_script_enabled).toBe(true);
    // post-response block is now imported (Story 20.9), not skipped.
    expect(scripted?.post_response_script).toBe('bru.setVar("token", res.body.token);');
    expect(scripted?.post_response_script_enabled).toBe(true);

    const health = result.requests.find((r) => r.name === 'Health');
    expect(health?.pre_request_script).toBe('');
    expect(health?.post_response_script ?? '').toBe('');

    // Only the (unsupported) tests assertion block still warns.
    const scriptWarnings = result.warnings.filter((w) => w.field === 'script');
    expect(scriptWarnings.every((w) => w.severity === 'info')).toBe(true);
    expect(scriptWarnings.some((w) => /tests/i.test(w.message))).toBe(true);
    expect(scriptWarnings.some((w) => /not supported yet/i.test(w.message))).toBe(false);
  });

  it('imports post-response script from JSON export (Story 20.9)', () => {
    const json = JSON.stringify({
      meta: { name: 'API', type: 'collection' },
      items: [
        {
          type: 'http', name: 'S',
          request: {
            url: 'x', method: 'GET',
            script: { req: 'console.log(1);', res: 'console.log(2);' },
            tests: 'expect(true);',
          },
        },
      ],
    });
    const result = parseBruno(json);
    expect(result.requests[0].pre_request_script).toBe('console.log(1);');
    expect(result.requests[0].post_response_script).toBe('console.log(2);');
    expect(result.requests[0].post_response_script_enabled).toBe(true);
  });
});

describe('parseBruno (JSON export path)', () => {
  it('parses items and nested folders to the same shape', () => {
    const result = parseBruno(JSON_EXPORT);
    expect(result.collection.name).toBe('My API');
    expect(result.folders).toHaveLength(1);
    expect(result.folders[0].name).toBe('Auth');
    expect(result.requests).toHaveLength(2);

    const users = result.requests.find((r) => r.name === 'Get Users');
    expect(users?.method).toBe('GET');
    expect(users?.headers).toEqual([{ key: 'Accept', value: 'application/json', enabled: true }]);
    expect(users?.query_params).toEqual([{ key: 'page', value: '1', enabled: true }]);
    expect(users?.folder_id).toBeNull();

    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.folder_id).toBe(result.folders[0].id);
    expect(login?.body_type).toBe('json');
    expect(login?.body_content).toBe('{"x":1}');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseBruno('not json')).toThrow('Invalid JSON');
  });

  it('throws on non-Bruno JSON', () => {
    expect(() => parseBruno(JSON.stringify({ info: { name: 'Postman' }, item: [] }))).toThrow('Not a Bruno');
  });
});

describe('parseBrunoZip', () => {
  it('unzips a Bruno collection and strips the common top-level folder', () => {
    const zip = zipSync({
      'My API/bruno.json': strToU8('{"version":"1","name":"My API","type":"collection"}'),
      'My API/Health.bru': strToU8(HEALTH_BRU),
      'My API/Auth/Login.bru': strToU8(LOGIN_BRU),
      'My API/environments/Local.bru': strToU8('vars {\n  baseUrl: http://localhost\n}\n'),
    });
    const result = parseBrunoZip(zip, 'fallback');
    // top-level "My API/" stripped → name from the zip's root folder
    expect(result.collection.name).toBe('My API');
    expect(result.folders.map((f) => f.name)).toEqual(['Auth']);
    expect(result.requests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(result.environments.map((e) => e.name)).toEqual(['Local']);
    const login = result.requests.find((r) => r.name === 'Login');
    expect(login?.folder_id).toBe(result.folders[0].id);
  });

  it('ignores __MACOSX/ and ._AppleDouble cruft from Finder-made zips', () => {
    const zip = zipSync({
      'Bruno copy/Health.bru': strToU8(HEALTH_BRU),
      'Bruno copy/Auth/Login.bru': strToU8(LOGIN_BRU),
      '__MACOSX/Bruno copy/._Health.bru': strToU8('garbage'),
      '__MACOSX/Bruno copy/Auth/._Login.bru': strToU8('garbage'),
      'Bruno copy/Auth/._Login.bru': strToU8('garbage'),
      'Bruno copy/.DS_Store': strToU8('garbage'),
    });
    const result = parseBrunoZip(zip, 'fallback');
    expect(result.collection.name).toBe('Bruno copy');
    expect(result.requests.map((r) => r.name).sort()).toEqual(['Health', 'Login']);
    expect(result.warnings).toHaveLength(0); // no bogus "No .bru blocks found"
  });

  it('falls back to the provided name when there is no common top folder', () => {
    const zip = zipSync({
      'Health.bru': strToU8(HEALTH_BRU),
      'Login.bru': strToU8(LOGIN_BRU),
    });
    const result = parseBrunoZip(zip, 'fallback');
    expect(result.collection.name).toBe('fallback');
    expect(result.requests).toHaveLength(2);
  });
});

describe('detection', () => {
  it('detects a Bruno JSON export', () => {
    expect(isBrunoJsonExport({ meta: { type: 'collection' }, items: [] })).toBe(true);
    expect(isBrunoJsonExport({ items: [] })).toBe(true);
    expect(isBrunoJsonExport({ info: { name: 'x' }, item: [] })).toBe(false);
    expect(isBrunoJsonExport(null)).toBe(false);
  });

  it('detects a Bruno directory listing', () => {
    expect(isBrunoDirectory(['bruno.json', 'Health.bru'])).toBe(true);
    expect(isBrunoDirectory(['Auth/Login.bru'])).toBe(true);
    expect(isBrunoDirectory(['readme.md', 'data.json'])).toBe(false);
  });
});
