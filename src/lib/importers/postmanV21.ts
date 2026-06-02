import type { KeyValuePair } from '@/lib/db';
import type { ImportResult, ImportWarning } from './types';
import { convertPmToFb } from './pmToFb';

// ─── Postman v2.1 JSON Shape ─────────────────────────────────────────────────

interface PostmanHeader { key: string; value: string; disabled?: boolean }
interface PostmanQueryParam { key: string; value: string; disabled?: boolean }
interface PostmanUrl { raw?: string; host?: string[]; path?: string[]; query?: PostmanQueryParam[] }
interface PostmanBody { mode?: string; raw?: string }
interface PostmanAuth { type?: string; bearer?: Array<{ key: string; value: string }>; basic?: Array<{ key: string; value: string }>; apikey?: Array<{ key: string; value: string }> }
interface PostmanRequest { method?: string; url?: PostmanUrl | string; header?: PostmanHeader[]; body?: PostmanBody; auth?: PostmanAuth }
interface PostmanVariable { key?: string; value?: string; disabled?: boolean }
interface PostmanEvent { listen?: string; script?: { exec?: string[]; type?: string } }
interface PostmanItem { name?: string; item?: PostmanItem[]; request?: PostmanRequest; event?: PostmanEvent[] }
interface PostmanCollection { info?: { name?: string; schema?: string }; item?: PostmanItem[]; event?: PostmanEvent[]; variable?: PostmanVariable[] }

function resolveUrl(url: PostmanUrl | string | undefined): string {
  if (!url) return '';
  if (typeof url === 'string') return url;
  return url.raw ?? '';
}

function mapHeaders(headers: PostmanHeader[] | undefined): KeyValuePair[] {
  return (headers ?? []).map((h) => ({ key: h.key, value: h.value, enabled: !h.disabled }));
}

function mapQueryParams(url: PostmanUrl | string | undefined): KeyValuePair[] {
  if (!url || typeof url === 'string') return [];
  return (url.query ?? []).map((q) => ({ key: q.key, value: q.value, enabled: !q.disabled }));
}

type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

function mapAuth(auth: PostmanAuth | undefined): { auth_type: AuthType; auth_config: Record<string, string> } {
  if (!auth?.type) return { auth_type: 'none', auth_config: {} };
  const toMap = (arr?: Array<{ key: string; value: string }>): Record<string, string> =>
    Object.fromEntries((arr ?? []).map((e) => [e.key, e.value]));

  switch (auth.type) {
    case 'bearer': return { auth_type: 'bearer', auth_config: toMap(auth.bearer) };
    case 'basic': return { auth_type: 'basic', auth_config: toMap(auth.basic) };
    case 'apikey': return { auth_type: 'api-key', auth_config: toMap(auth.apikey) };
    default: return { auth_type: 'none', auth_config: {} };
  }
}

function mapBodyMode(mode?: string): 'none' | 'raw' | 'json' | 'urlencoded' {
  switch (mode) {
    case 'raw': return 'raw';
    case 'urlencoded': return 'urlencoded';
    default: return 'none';
  }
}

export function parsePostmanV21(json: string): ImportResult {
  let data: PostmanCollection;
  try { data = JSON.parse(json) as PostmanCollection; }
  catch { throw new Error('Invalid JSON: cannot parse Postman collection file'); }

  if (!data.info?.name) throw new Error('Missing collection name (info.name)');
  const collectionName = data.info.name;
  const schema = data.info.schema ?? '';
  if (schema && !schema.includes('v2.1') && !schema.includes('v2.0')) {
    throw new Error(`Unsupported Postman schema: ${schema}. Only v2.0/v2.1 are supported.`);
  }

  const collectionId = crypto.randomUUID();
  const warnings: ImportWarning[] = [];
  const folders: ImportResult['folders'] = [];
  const requests: ImportResult['requests'] = [];

  if (data.event?.some((e) => e.listen === 'test')) {
    warnings.push({ field: 'event', message: 'Collection-level test scripts are not supported and were skipped (per-request test scripts are imported as post-response scripts)', severity: 'info' });
  }

  const environments: ImportResult['environments'] = [];
  if (data.variable?.length) {
    environments.push({
      name: `${data.info.name} Variables`,
      variables: data.variable
        .filter((v): v is PostmanVariable & { key: string } => !!v.key)
        .map((v) => ({ key: v.key, value: v.value ?? '', enabled: !v.disabled })),
    });
  }

  // Script mapping (aligned to the global/pre/post slot model):
  //   • collection-level pre-request  → the collection's "global" script
  //   • folder-level pre-request       → inlined into each contained request's pre-request
  //   • request-level pre-request/test → the request's pre / post-response slots
  const getPrerequestExec = (events?: PostmanEvent[]): string =>
    events?.find((e) => e.listen === 'prerequest')?.script?.exec?.join('\n') ?? '';

  const getTestExec = (events?: PostmanEvent[]): string =>
    events?.find((e) => e.listen === 'test')?.script?.exec?.join('\n') ?? '';

  // Convert once and surface a warning if anything needs manual review.
  const convertScoped = (raw: string, scopeLabel: string): string => {
    const { code, unconverted } = convertPmToFb(raw);
    if (unconverted.length) {
      warnings.push({
        field: scopeLabel,
        message: `Script from "${scopeLabel}" imported, but ${unconverted.length} Postman API(s) need manual review (e.g. ${unconverted[0].split(' ')[0]}).`,
        severity: 'warning',
      });
    }
    return code;
  };

  interface AncestorScript { code: string; scope: string }

  function processItems(
    items: PostmanItem[],
    parentFolderId: string | null,
    sortStart: number,
    inherited: AncestorScript[],
  ): void {
    let sort = sortStart;
    for (const item of items) {
      if (item.item) {
        const folderId = crypto.randomUUID();
        const folderName = item.name ?? 'Unnamed Folder';
        folders.push({ id: folderId, collection_id: collectionId, parent_id: parentFolderId, name: folderName, sort_order: sort++ });

        const folderRaw = getPrerequestExec(item.event);
        const childInherited = folderRaw.trim()
          ? [...inherited, { code: convertScoped(folderRaw, folderName), scope: folderName }]
          : inherited;
        processItems(item.item, folderId, 0, childInherited);
      } else if (item.request) {
        const req = item.request;
        const { auth_type, auth_config } = mapAuth(req.auth);
        const bodyMode = mapBodyMode(req.body?.mode);

        if (req.body?.mode && req.body.mode !== 'raw' && req.body.mode !== 'urlencoded') {
          warnings.push({ field: `request.${item.name}`, message: `Body mode "${req.body.mode}" not fully supported — imported as raw`, severity: 'warning' });
        }

        const reqRaw = getPrerequestExec(item.event);
        const ownPre = reqRaw.trim() ? convertScoped(reqRaw, `request.${item.name}`) : '';
        // Folder-level ancestor scripts run before the request's own — inline them
        // (collection-level lives in the collection's global slot, handled below).
        const preRequestScript = [...inherited.map((a) => a.code), ownPre].filter((s) => s.trim()).join('\n\n');
        const testRaw = getTestExec(item.event);
        const postResponseScript = testRaw.trim() ? convertScoped(testRaw, `request.${item.name}`) : '';

        requests.push({
          id: crypto.randomUUID(),
          collection_id: collectionId,
          folder_id: parentFolderId,
          name: item.name ?? 'Unnamed Request',
          method: req.method ?? 'GET',
          url: resolveUrl(req.url),
          headers: mapHeaders(req.header),
          query_params: mapQueryParams(req.url),
          body_type: bodyMode,
          body_content: req.body?.raw ?? '',
          auth_type,
          auth_config,
          pre_request_script: preRequestScript,
          pre_request_script_enabled: true,
          pre_request_template_id: null,
          post_response_script: postResponseScript,
          post_response_script_enabled: postResponseScript.trim().length > 0,
          sort_order: sort++,
        });
      }
    }
  }

  // Collection-level pre-request script → the collection's "global" slot.
  const collectionRaw = getPrerequestExec(data.event);
  const collectionScript = collectionRaw.trim() ? convertScoped(collectionRaw, collectionName) : '';

  processItems(data.item ?? [], null, 0, []);

  return {
    collection: {
      id: collectionId,
      name: data.info.name,
      description: '',
      default_environment_id: null,
      pre_request_script: collectionScript,
      pre_request_script_enabled: collectionScript.trim().length > 0,
    },
    folders,
    requests,
    warnings,
    environments,
  };
}
