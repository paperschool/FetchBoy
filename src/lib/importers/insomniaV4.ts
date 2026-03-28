import type { KeyValuePair } from '@/lib/db';
import type { ImportResult, ImportWarning } from './types';

// ─── Insomnia v4 Export Shape ────────────────────────────────────────────────

interface InsomniaHeader { name: string; value: string; disabled?: boolean }
interface InsomniaBody { mimeType?: string; text?: string }
interface InsomniaAuth { type?: string; token?: string; username?: string; password?: string; prefix?: string }
interface InsomniaResource {
  _id: string;
  _type: string;
  parentId: string | null;
  name?: string;
  method?: string;
  url?: string;
  headers?: InsomniaHeader[];
  body?: InsomniaBody;
  authentication?: InsomniaAuth;
  data?: Record<string, string>;
}
interface InsomniaExport { resources?: InsomniaResource[]; __export_format?: number }

function mapHeaders(headers: InsomniaHeader[] | undefined): KeyValuePair[] {
  return (headers ?? []).map((h) => ({ key: h.name, value: h.value, enabled: !h.disabled }));
}

type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

function mapAuth(auth: InsomniaAuth | undefined): { auth_type: AuthType; auth_config: Record<string, string> } {
  if (!auth?.type) return { auth_type: 'none', auth_config: {} };
  switch (auth.type) {
    case 'bearer': return { auth_type: 'bearer', auth_config: { token: auth.token ?? '' } };
    case 'basic': return { auth_type: 'basic', auth_config: { username: auth.username ?? '', password: auth.password ?? '' } };
    default: return { auth_type: 'none', auth_config: {} };
  }
}

function inferBodyMode(mimeType?: string): 'none' | 'raw' | 'json' | 'urlencoded' {
  if (!mimeType) return 'none';
  if (mimeType.includes('json')) return 'json';
  if (mimeType.includes('urlencoded')) return 'urlencoded';
  return 'raw';
}

export function parseInsomniaV4(json: string): ImportResult {
  let data: InsomniaExport;
  try { data = JSON.parse(json) as InsomniaExport; }
  catch { throw new Error('Invalid JSON: cannot parse Insomnia export file'); }

  const resources = data.resources ?? [];
  if (resources.length === 0) throw new Error('No resources found in Insomnia export');

  const warnings: ImportWarning[] = [];

  const workspace = resources.find((r) => r._type === 'workspace');
  if (!workspace) throw new Error('No workspace found in Insomnia export');

  const collectionId = crypto.randomUUID();

  // Build ID map for parent references
  const idMap = new Map<string, string>();
  idMap.set(workspace._id, collectionId);

  const requestGroups = resources.filter((r) => r._type === 'request_group');
  for (const g of requestGroups) idMap.set(g._id, crypto.randomUUID());

  const requestResources = resources.filter((r) => r._type === 'request');
  const envResources = resources.filter((r) => r._type === 'environment');

  const environments: ImportResult['environments'] = envResources
    .filter((e) => e.data && Object.keys(e.data).length > 0)
    .map((e) => ({
      name: `${workspace.name ?? 'Imported'} - ${e.name ?? 'Environment'}`,
      variables: Object.entries(e.data!).map(([key, value]) => ({ key, value: String(value), enabled: true })),
    }));

  const folders: ImportResult['folders'] = requestGroups.map((g, i) => ({
    id: idMap.get(g._id)!,
    collection_id: collectionId,
    parent_id: g.parentId === workspace._id ? null : (idMap.get(g.parentId ?? '') ?? null),
    name: g.name ?? 'Unnamed Folder',
    sort_order: i,
  }));

  const requests: ImportResult['requests'] = requestResources.map((r, i) => {
    const { auth_type, auth_config } = mapAuth(r.authentication);
    const parentId = r.parentId ?? '';
    const folderId = parentId === workspace._id ? null : (idMap.get(parentId) ?? null);

    return {
      id: crypto.randomUUID(),
      collection_id: collectionId,
      folder_id: folderId,
      name: r.name ?? 'Unnamed Request',
      method: r.method ?? 'GET',
      url: r.url ?? '',
      headers: mapHeaders(r.headers),
      query_params: [],
      body_type: inferBodyMode(r.body?.mimeType),
      body_content: r.body?.text ?? '',
      auth_type,
      auth_config,
      pre_request_script: '',
      pre_request_script_enabled: true,
      sort_order: i,
    };
  });

  return {
    collection: { id: collectionId, name: workspace.name ?? 'Imported Workspace', description: '', default_environment_id: null },
    folders,
    requests,
    warnings,
    environments,
  };
}
