import { unzipSync, strFromU8 } from 'fflate';
import type { KeyValuePair, Request } from '@/lib/db';
import type { ImportResult, ImportWarning } from './types';

// ─── Bruno format parser ──────────────────────────────────────────────────────
// Two ingestion paths converge on one mapping core:
//   • parseBrunoCollection(files) — native on-disk collection (folder of .bru files)
//   • parseBruno(json)            — single-file Bruno JSON collection export
// Both produce an identical ImportResult.

type BodyType = Request['body_type'];

const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

// ─── .bru DSL tokenizer ────────────────────────────────────────────────────────

export interface BruBlock {
  name: string;
  body: string;
}

/**
 * Split a .bru file into top-level `name { ... }` blocks. Tracks brace depth so
 * nested braces inside body blocks (e.g. body:json) are not mistaken for block
 * boundaries.
 */
export function tokenizeBru(text: string): BruBlock[] {
  const blocks: BruBlock[] = [];
  let i = 0;
  const n = text.length;

  while (i < n) {
    while (i < n && /\s/.test(text[i])) i++;
    if (i >= n) break;

    // Read the block name up to the opening brace (must appear before a newline).
    const nameStart = i;
    while (i < n && text[i] !== '{' && text[i] !== '\n') i++;
    if (i >= n || text[i] === '\n') {
      // No opening brace on this line — skip the stray line.
      i++;
      continue;
    }
    const name = text.slice(nameStart, i).trim();
    i++; // consume '{'

    const bodyStart = i;
    let depth = 1;
    while (i < n && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
      i++;
    }
    const body = text.slice(bodyStart, i);
    i++; // consume closing '}'

    if (name) blocks.push({ name, body });
  }

  return blocks;
}

/** Parse a `key: value` block body into KeyValuePair[]. `~` prefix marks disabled. */
function parseKvLines(body: string): KeyValuePair[] {
  const pairs: KeyValuePair[] = [];
  for (const rawLine of body.split('\n')) {
    let line = rawLine.trim();
    if (!line) continue;
    let enabled = true;
    if (line.startsWith('~')) {
      enabled = false;
      line = line.slice(1).trim();
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    const value = line.slice(idx + 1).trim();
    pairs.push({ key, value, enabled });
  }
  return pairs;
}

function kvToMap(body: string): Record<string, string> {
  return Object.fromEntries(parseKvLines(body).map((p) => [p.key, p.value]));
}

function mapBruBodyType(mode: string): BodyType {
  switch (mode) {
    case 'json': return 'json';
    case 'form-urlencoded': return 'urlencoded';
    case 'multipart-form': return 'form-data';
    default: return mode === 'none' || mode === '' ? 'none' : 'raw';
  }
}

type AuthType = Request['auth_type'];
interface ResolvedAuth {
  auth_type: AuthType;
  auth_config: Record<string, string>;
}
type AuthMapping =
  | { kind: 'resolved'; auth: ResolvedAuth }
  | { kind: 'inherit' }
  | { kind: 'unknown'; mode: string };

const NO_AUTH: ResolvedAuth = { auth_type: 'none', auth_config: {} };

/** Map a Bruno auth mode + key/value config into FetchBoy's auth model. */
function mapAuthMode(mode: string, config: Record<string, string>): AuthMapping {
  switch (mode) {
    case '':
    case 'none':
      return { kind: 'resolved', auth: NO_AUTH };
    case 'inherit':
      return { kind: 'inherit' };
    case 'bearer':
      return { kind: 'resolved', auth: { auth_type: 'bearer', auth_config: { token: config.token ?? '' } } };
    case 'basic':
      return { kind: 'resolved', auth: { auth_type: 'basic', auth_config: { username: config.username ?? '', password: config.password ?? '' } } };
    case 'apikey':
    case 'api-key':
      return { kind: 'resolved', auth: { auth_type: 'api-key', auth_config: config.key ? { [config.key]: config.value ?? '' } : {} } };
    default:
      return { kind: 'unknown', mode };
  }
}

/** Extract the raw auth mode + config from a .bru file (request, folder.bru, collection.bru). */
function extractBruAuth(blocks: BruBlock[], methodKv: Record<string, string>): { mode: string; config: Record<string, string> } {
  const authBlock = blocks.find((b) => b.name.startsWith('auth:'));
  if (authBlock) return { mode: authBlock.name.slice('auth:'.length), config: kvToMap(authBlock.body) };
  const generic = blocks.find((b) => b.name === 'auth');
  if (generic) {
    const kv = kvToMap(generic.body);
    if (kv.mode) return { mode: kv.mode, config: {} };
  }
  return { mode: methodKv.auth ?? 'none', config: {} };
}

export interface ParsedBruRequest {
  name: string;
  method: string;
  url: string;
  headers: KeyValuePair[];
  query: KeyValuePair[];
  bodyType: BodyType;
  bodyContent: string;
  authMode: string;
  authConfig: Record<string, string>;
  preRequestScript: string;
  hasPostResponse: boolean;
  hasTests: boolean;
  hasPreVars: boolean;
}

/** Parse a single .bru request file into a normalized intermediate shape. */
export function parseBruRequest(content: string): ParsedBruRequest {
  const blocks = tokenizeBru(content);
  if (blocks.length === 0) throw new Error('No .bru blocks found');

  const meta = kvToMap(blocks.find((b) => b.name === 'meta')?.body ?? '');
  const verbBlock = blocks.find((b) => HTTP_VERBS.has(b.name.toLowerCase()));
  if (!verbBlock) throw new Error('No HTTP method block found');
  const methodKv = kvToMap(verbBlock.body);

  const headersBlock = blocks.find((b) => b.name === 'headers');
  const queryBlock = blocks.find((b) => b.name === 'params:query' || b.name === 'query');
  const bodyBlock = blocks.find((b) => b.name.startsWith('body:'));
  const auth = extractBruAuth(blocks, methodKv);
  const preReqBlock = blocks.find((b) => b.name === 'script:pre-request');

  const bodyMode = bodyBlock ? bodyBlock.name.slice('body:'.length) : (methodKv.body ?? 'none');

  return {
    name: meta.name ?? 'Unnamed Request',
    method: verbBlock.name.toUpperCase(),
    url: methodKv.url ?? '',
    headers: headersBlock ? parseKvLines(headersBlock.body) : [],
    query: queryBlock ? parseKvLines(queryBlock.body) : [],
    bodyType: mapBruBodyType(bodyMode),
    bodyContent: bodyBlock ? bodyBlock.body.trim() : '',
    authMode: auth.mode,
    authConfig: auth.config,
    preRequestScript: preReqBlock ? preReqBlock.body.trim() : '',
    hasPostResponse: blocks.some((b) => b.name === 'script:post-response'),
    hasTests: blocks.some((b) => b.name === 'tests'),
    hasPreVars: blocks.some((b) => b.name === 'vars:pre-request'),
  };
}

function buildRequest(
  parsed: ParsedBruRequest,
  collectionId: string,
  folderId: string | null,
  sortOrder: number,
  auth: ResolvedAuth,
): ImportResult['requests'][number] {
  return {
    id: crypto.randomUUID(),
    collection_id: collectionId,
    folder_id: folderId,
    name: parsed.name,
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers,
    query_params: parsed.query,
    body_type: parsed.bodyType,
    body_content: parsed.bodyContent,
    auth_type: auth.auth_type,
    auth_config: auth.auth_config,
    pre_request_script: parsed.preRequestScript,
    pre_request_script_enabled: parsed.preRequestScript.length > 0,
    sort_order: sortOrder,
  };
}

// ─── Directory ingestion ───────────────────────────────────────────────────────

export interface BrunoSourceFile {
  /** Path relative to the collection root, using '/' separators. */
  path: string;
  content: string;
}

/** macOS archive/Finder cruft that must never be treated as collection files. */
export function isJunkPath(path: string): boolean {
  const segs = path.split('/');
  const base = segs[segs.length - 1];
  return segs.includes('__MACOSX') || base.startsWith('._') || base === '.DS_Store';
}

/** Parse a single environment .bru file (`vars` / `vars:secret` blocks) into an environment. */
export function parseBrunoEnvFile(content: string, name: string): ImportResult['environments'][number] {
  const blocks = tokenizeBru(content);
  const variables: KeyValuePair[] = [];
  for (const block of blocks) {
    if (block.name === 'vars') {
      variables.push(...parseKvLines(block.body));
    } else if (block.name === 'vars:secret') {
      variables.push(...parseKvLines(block.body).map((v) => ({ ...v, secret: true })));
    }
  }
  return { name, variables };
}

export function parseBrunoCollection(files: BrunoSourceFile[], collectionName: string): ImportResult {
  const collectionId = crypto.randomUUID();
  const warnings: ImportWarning[] = [];
  const folders: ImportResult['folders'] = [];
  const requests: ImportResult['requests'] = [];
  const environments: ImportResult['environments'] = [];
  const folderIdByPath = new Map<string, string>();

  function ensureFolder(dirPath: string): string | null {
    if (!dirPath) return null;
    const segments = dirPath.split('/');
    let parentId: string | null = null;
    let accum = '';
    for (const seg of segments) {
      accum = accum ? `${accum}/${seg}` : seg;
      const existing = folderIdByPath.get(accum);
      if (existing) {
        parentId = existing;
        continue;
      }
      const id = crypto.randomUUID();
      folders.push({ id, collection_id: collectionId, parent_id: parentId, name: seg, sort_order: folders.length });
      folderIdByPath.set(accum, id);
      parentId = id;
    }
    return folderIdByPath.get(dirPath) ?? null;
  }

  const bruFiles = files
    .filter((f) => f.path.endsWith('.bru') && !isJunkPath(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));

  // Collection- and folder-level auth (for `auth: inherit` resolution).
  const folderRawAuth = new Map<string, { mode: string; config: Record<string, string> }>();
  let collectionRawAuth: { mode: string; config: Record<string, string> } | null = null;
  for (const file of bruFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    if (fileName === 'collection.bru') {
      collectionRawAuth = extractBruAuth(tokenizeBru(file.content), {});
    } else if (fileName === 'folder.bru') {
      folderRawAuth.set(parts.slice(0, -1).join('/'), extractBruAuth(tokenizeBru(file.content), {}));
    }
  }

  function resolveInherit(dirPath: string): ResolvedAuth {
    const segs = dirPath ? dirPath.split('/') : [];
    for (let i = segs.length; i >= 1; i--) {
      const raw = folderRawAuth.get(segs.slice(0, i).join('/'));
      if (raw) {
        const m = mapAuthMode(raw.mode, raw.config);
        if (m.kind === 'resolved') return m.auth;
      }
    }
    if (collectionRawAuth) {
      const m = mapAuthMode(collectionRawAuth.mode, collectionRawAuth.config);
      if (m.kind === 'resolved') return m.auth;
    }
    return NO_AUTH;
  }

  // A .bru is an environment when its immediate parent directory is `environments`
  // (Bruno keeps these at the collection root, but multi-collection imports nest them).
  const isEnvFile = (parts: string[]): boolean =>
    parts.length >= 2 && parts[parts.length - 2] === 'environments';

  // Environments first, deterministic alphabetical by path.
  for (const file of bruFiles) {
    const parts = file.path.split('/');
    if (!isEnvFile(parts)) continue;
    // Name from the path minus the `environments` segment, e.g. "ASOS / Web Stubs".
    const fileName = parts[parts.length - 1].replace(/\.bru$/, '');
    const prefix = parts.slice(0, parts.length - 2);
    const envName = [...prefix, fileName].join(' / ');
    try {
      environments.push(parseBrunoEnvFile(file.content, envName));
    } catch (err) {
      warnings.push({
        field: file.path,
        message: `Failed to parse environment ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
      });
    }
  }

  for (const file of bruFiles) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];
    const dirSegs = parts.slice(0, -1);

    // environments handled above (at any depth); folder/collection files are metadata.
    if (isEnvFile(parts)) continue;
    if (fileName === 'folder.bru' || fileName === 'collection.bru') continue;

    let parsed: ParsedBruRequest;
    try {
      parsed = parseBruRequest(file.content);
    } catch (err) {
      warnings.push({
        field: file.path,
        message: `Failed to parse ${file.path}: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'warning',
      });
      continue;
    }

    const m = mapAuthMode(parsed.authMode, parsed.authConfig);
    let auth: ResolvedAuth;
    if (m.kind === 'resolved') {
      auth = m.auth;
    } else if (m.kind === 'inherit') {
      auth = resolveInherit(dirSegs.join('/'));
    } else {
      warnings.push({
        field: file.path,
        message: `Auth scheme "${m.mode}" is not supported — imported as none`,
        severity: 'warning',
      });
      auth = NO_AUTH;
    }

    if (parsed.hasPostResponse || parsed.hasTests) {
      warnings.push({
        field: 'script',
        message: `${parsed.name}: post-response/test scripts are not supported yet and were skipped`,
        severity: 'info',
      });
    }
    if (parsed.hasPreVars) {
      warnings.push({
        field: 'script',
        message: `${parsed.name}: pre-request vars are request-scoped and were not imported`,
        severity: 'info',
      });
    }

    const folderId = ensureFolder(dirSegs.join('/'));
    requests.push(buildRequest(parsed, collectionId, folderId, requests.length, auth));
  }

  return {
    collection: { id: collectionId, name: collectionName, description: '', default_environment_id: null },
    folders,
    requests,
    warnings,
    environments,
  };
}

// ─── Zip ingestion ─────────────────────────────────────────────────────────────

/**
 * Parse a zipped Bruno collection (Bruno's "Export Collection" produces a .zip).
 * Unzips in memory, strips a shared top-level folder if present, and reuses the
 * directory parser. Falls back to `fallbackName` when no root folder is detected.
 */
export function parseBrunoZip(data: Uint8Array, fallbackName: string): ImportResult {
  const entries = unzipSync(data);
  const raw: BrunoSourceFile[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.endsWith('/')) continue; // directory marker
    if (isJunkPath(path)) continue; // __MACOSX/, ._AppleDouble, .DS_Store
    raw.push({ path, content: strFromU8(bytes) });
  }

  // Bruno zips wrap everything in a single top-level folder named after the
  // collection (e.g. "My API/..."). Strip it so the folder tree is not doubled.
  let collectionName = fallbackName;
  let files = raw;
  if (raw.length > 0) {
    const topSeg = raw[0].path.split('/')[0];
    const allShareTop = raw.every((f) => f.path.includes('/') && f.path.split('/')[0] === topSeg);
    if (allShareTop) {
      collectionName = topSeg;
      files = raw.map((f) => ({ ...f, path: f.path.slice(topSeg.length + 1) }));
    }
  }

  return parseBrunoCollection(files, collectionName);
}

// ─── JSON export ingestion ─────────────────────────────────────────────────────

interface BrunoJsonHeader { name?: string; key?: string; value?: string; enabled?: boolean; disabled?: boolean }
interface BrunoJsonParam { name?: string; key?: string; value?: string; enabled?: boolean; disabled?: boolean; type?: string }
interface BrunoJsonBody { mode?: string; json?: string; text?: string; xml?: string; sparql?: string }
interface BrunoJsonAuth {
  mode?: string;
  bearer?: { token?: string };
  basic?: { username?: string; password?: string };
  apikey?: { key?: string; value?: string };
}
interface BrunoJsonRequest {
  url?: string;
  method?: string;
  headers?: BrunoJsonHeader[];
  params?: BrunoJsonParam[];
  query?: BrunoJsonParam[];
  body?: BrunoJsonBody;
  auth?: BrunoJsonAuth;
  script?: { req?: string; res?: string };
  tests?: string;
  vars?: { req?: unknown[]; res?: unknown[] };
}
interface BrunoJsonItem extends BrunoJsonRequest {
  type?: string;
  name?: string;
  seq?: number;
  request?: BrunoJsonRequest;
  items?: BrunoJsonItem[];
}
interface BrunoJsonEnvVar { name?: string; key?: string; value?: string; enabled?: boolean; secret?: boolean }
interface BrunoJsonEnv { name?: string; variables?: BrunoJsonEnvVar[] }
interface BrunoJsonCollection {
  meta?: { name?: string; type?: string };
  name?: string;
  items?: BrunoJsonItem[];
  environments?: BrunoJsonEnv[];
  auth?: BrunoJsonAuth;
}

/** Map a Bruno JSON-export auth object into FetchBoy's auth model. */
function mapJsonAuth(auth: BrunoJsonAuth | undefined): AuthMapping {
  if (!auth?.mode) return { kind: 'resolved', auth: NO_AUTH };
  switch (auth.mode) {
    case 'bearer':
      return { kind: 'resolved', auth: { auth_type: 'bearer', auth_config: { token: auth.bearer?.token ?? '' } } };
    case 'basic':
      return { kind: 'resolved', auth: { auth_type: 'basic', auth_config: { username: auth.basic?.username ?? '', password: auth.basic?.password ?? '' } } };
    case 'apikey':
    case 'api-key':
      return { kind: 'resolved', auth: { auth_type: 'api-key', auth_config: auth.apikey?.key ? { [auth.apikey.key]: auth.apikey.value ?? '' } : {} } };
    case 'none':
      return { kind: 'resolved', auth: NO_AUTH };
    case 'inherit':
      return { kind: 'inherit' };
    default:
      return { kind: 'unknown', mode: auth.mode };
  }
}

function mapJsonEnvironments(envs: BrunoJsonEnv[] | undefined): ImportResult['environments'] {
  return (envs ?? []).map((e) => ({
    name: e.name ?? 'Environment',
    variables: (e.variables ?? []).map((v) => {
      const kv: KeyValuePair = { key: v.name ?? v.key ?? '', value: v.value ?? '', enabled: v.enabled ?? true };
      if (v.secret) kv.secret = true;
      return kv;
    }),
  }));
}

function mapJsonHeaders(headers: BrunoJsonHeader[] | undefined): KeyValuePair[] {
  return (headers ?? []).map((h) => ({
    key: h.name ?? h.key ?? '',
    value: h.value ?? '',
    enabled: h.enabled ?? !h.disabled,
  }));
}

function mapJsonQuery(req: BrunoJsonRequest): KeyValuePair[] {
  const params = req.params ?? req.query ?? [];
  return params
    .filter((p) => !p.type || p.type === 'query')
    .map((p) => ({ key: p.name ?? p.key ?? '', value: p.value ?? '', enabled: p.enabled ?? !p.disabled }));
}

function mapJsonBody(body: BrunoJsonBody | undefined): { type: BodyType; content: string } {
  if (!body || !body.mode || body.mode === 'none') return { type: 'none', content: '' };
  switch (body.mode) {
    case 'json': return { type: 'json', content: body.json ?? '' };
    case 'text': return { type: 'raw', content: body.text ?? '' };
    case 'xml': return { type: 'raw', content: body.xml ?? '' };
    case 'sparql': return { type: 'raw', content: body.sparql ?? '' };
    case 'formUrlEncoded': return { type: 'urlencoded', content: '' };
    case 'multipartForm': return { type: 'form-data', content: '' };
    default: return { type: 'raw', content: '' };
  }
}

/** True when a parsed object looks like a Bruno JSON collection export. */
export function isBrunoJsonExport(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as { meta?: { type?: string }; items?: unknown };
  return d.meta?.type === 'collection' || Array.isArray(d.items);
}

/** True when a directory listing (relative paths) looks like a Bruno collection. */
export function isBrunoDirectory(paths: string[]): boolean {
  return paths.some((p) => p === 'bruno.json' || p.endsWith('/bruno.json')) ||
    paths.some((p) => p.endsWith('.bru'));
}

export function parseBruno(json: string): ImportResult {
  let data: BrunoJsonCollection;
  try {
    data = JSON.parse(json) as BrunoJsonCollection;
  } catch {
    throw new Error('Invalid JSON: cannot parse Bruno collection export');
  }
  if (!isBrunoJsonExport(data)) {
    throw new Error('Not a Bruno collection export (missing meta.type "collection" or items array)');
  }

  const collectionId = crypto.randomUUID();
  const warnings: ImportWarning[] = [];
  const folders: ImportResult['folders'] = [];
  const requests: ImportResult['requests'] = [];
  const name = data?.meta?.name ?? data?.name ?? 'Imported Bruno Collection';

  // Resolve an item's auth against the inherited (folder/collection) auth.
  function resolve(mapping: AuthMapping, inherited: ResolvedAuth, field: string): ResolvedAuth {
    if (mapping.kind === 'resolved') return mapping.auth;
    if (mapping.kind === 'inherit') return inherited;
    warnings.push({ field, message: `Auth scheme "${mapping.mode}" is not supported — imported as none`, severity: 'warning' });
    return NO_AUTH;
  }

  function walk(items: BrunoJsonItem[] | undefined, parentId: string | null, inheritedAuth: ResolvedAuth): void {
    let sort = 0;
    for (const item of items ?? []) {
      if (item.type === 'folder' || Array.isArray(item.items)) {
        const id = crypto.randomUUID();
        folders.push({ id, collection_id: collectionId, parent_id: parentId, name: item.name ?? 'Unnamed Folder', sort_order: sort++ });
        const folderMapping = mapJsonAuth((item.request ?? item).auth);
        const folderAuth = folderMapping.kind === 'resolved' ? folderMapping.auth : inheritedAuth;
        walk(item.items, id, folderAuth);
      } else {
        const r = item.request ?? item;
        const body = mapJsonBody(r.body);
        const auth = resolve(mapJsonAuth(r.auth), inheritedAuth, item.name ?? 'request');
        const preScript = (r.script?.req ?? '').trim();
        const label = item.name ?? 'Unnamed Request';
        if (r.script?.res || r.tests) {
          warnings.push({ field: 'script', message: `${label}: post-response/test scripts are not supported yet and were skipped`, severity: 'info' });
        }
        if (r.vars?.req?.length) {
          warnings.push({ field: 'script', message: `${label}: pre-request vars are request-scoped and were not imported`, severity: 'info' });
        }
        requests.push({
          id: crypto.randomUUID(),
          collection_id: collectionId,
          folder_id: parentId,
          name: label,
          method: (r.method ?? 'GET').toUpperCase(),
          url: r.url ?? '',
          headers: mapJsonHeaders(r.headers),
          query_params: mapJsonQuery(r),
          body_type: body.type,
          body_content: body.content,
          auth_type: auth.auth_type,
          auth_config: auth.auth_config,
          pre_request_script: preScript,
          pre_request_script_enabled: preScript.length > 0,
          sort_order: sort++,
        });
      }
    }
  }

  const collectionMapping = mapJsonAuth(data?.auth);
  const collectionAuth = collectionMapping.kind === 'resolved' ? collectionMapping.auth : NO_AUTH;
  walk(data?.items, null, collectionAuth);

  return {
    collection: { id: collectionId, name, description: '', default_environment_id: null },
    folders,
    requests,
    warnings,
    environments: mapJsonEnvironments(data?.environments),
  };
}
