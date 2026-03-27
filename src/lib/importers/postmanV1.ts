import type { KeyValuePair } from '@/lib/db';
import type { ImportResult, ImportWarning } from './types';

// ─── Postman v1 JSON Shape ───────────────────────────────────────────────────

interface PostmanV1DataParam { key: string; value: string; type?: string; enabled?: boolean }
interface PostmanV1Folder { id: string; name: string; order?: string[] }
interface PostmanV1Request {
  id: string;
  name?: string;
  method?: string;
  url?: string;
  headers?: string; // newline-separated "Key: Value" pairs
  data?: PostmanV1DataParam[] | string | null;
  dataMode?: string; // "params" | "raw" | "urlencoded"
  rawModeData?: string;
  collectionId?: string;
  description?: string;
  preRequestScript?: string;
  tests?: string;
}
interface PostmanV1Collection {
  id?: string;
  name?: string;
  description?: string;
  order?: string[];
  folders?: PostmanV1Folder[];
  requests?: PostmanV1Request[];
  // v2.1 indicator — if present, this isn't v1
  info?: unknown;
}

function parseHeaderString(raw: string | undefined): KeyValuePair[] {
  if (!raw || !raw.trim()) return [];
  return raw.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes(':'))
    .map((line) => {
      const idx = line.indexOf(':');
      return { key: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim(), enabled: true };
    });
}

function inferBodyMode(dataMode?: string): 'none' | 'raw' | 'json' | 'urlencoded' {
  switch (dataMode) {
    case 'raw': return 'raw';
    case 'urlencoded': return 'urlencoded';
    default: return 'none';
  }
}

function getBodyContent(req: PostmanV1Request): string {
  if (req.rawModeData) return req.rawModeData;
  if (typeof req.data === 'string') return req.data;
  return '';
}

/** Detect whether a parsed JSON object is Postman v1 format. */
export function isPostmanV1(data: Record<string, unknown>): boolean {
  return !data.info && Array.isArray(data.requests);
}

export function parsePostmanV1(json: string): ImportResult {
  let data: PostmanV1Collection;
  try { data = JSON.parse(json) as PostmanV1Collection; }
  catch { throw new Error('Invalid JSON: cannot parse Postman collection file'); }

  if (data.info) throw new Error('This looks like Postman v2.x — use the v2.1 parser instead');
  if (!data.name) throw new Error('Missing collection name');
  if (!data.requests?.length) throw new Error('No requests found in Postman v1 collection');

  const collectionId = crypto.randomUUID();
  const warnings: ImportWarning[] = [];

  // Build folder map: Postman v1 folders reference request IDs via order[]
  const folderMap = new Map<string, string>(); // postman folder id → new UUID
  const requestToFolder = new Map<string, string>(); // request id → new folder UUID

  const folders: ImportResult['folders'] = (data.folders ?? []).map((f, i) => {
    const newId = crypto.randomUUID();
    folderMap.set(f.id, newId);
    for (const reqId of f.order ?? []) {
      requestToFolder.set(reqId, newId);
    }
    return {
      id: newId,
      collection_id: collectionId,
      parent_id: null,
      name: f.name || 'Unnamed Folder',
      sort_order: i,
    };
  });

  // Map requests, using the order[] array for sort order at root level
  const rootOrder = data.order ?? [];
  const requests: ImportResult['requests'] = (data.requests ?? []).map((req) => {
    const folderId = requestToFolder.get(req.id) ?? null;
    const rootIdx = rootOrder.indexOf(req.id);
    const sortOrder = rootIdx >= 0 ? rootIdx : 999;

    if (req.preRequestScript?.trim()) {
      warnings.push({ field: `request.${req.name}`, message: 'Pre-request script not supported — skipped', severity: 'info' });
    }
    if (req.tests?.trim()) {
      warnings.push({ field: `request.${req.name}`, message: 'Test script not supported — skipped', severity: 'info' });
    }

    const bodyMode = inferBodyMode(req.dataMode);
    // v1 "params" dataMode means query params in body (form data), not URL query params
    const queryParams: KeyValuePair[] = [];
    const bodyContent = bodyMode === 'raw' ? getBodyContent(req) : '';

    return {
      id: crypto.randomUUID(),
      collection_id: collectionId,
      folder_id: folderId,
      name: req.name ?? 'Unnamed Request',
      method: req.method ?? 'GET',
      url: req.url ?? '',
      headers: parseHeaderString(req.headers),
      query_params: queryParams,
      body_type: bodyMode,
      body_content: bodyContent,
      auth_type: 'none' as const,
      auth_config: {},
      sort_order: sortOrder,
    };
  });

  return {
    collection: { id: collectionId, name: data.name, description: data.description ?? '', default_environment_id: null },
    folders,
    requests,
    warnings,
    environments: [],
  };
}
