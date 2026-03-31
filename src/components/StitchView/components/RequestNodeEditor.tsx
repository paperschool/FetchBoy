import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Import } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { HighlightedUrlInput } from '@/components/MainPanel/HighlightedUrlInput';
import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { resolveInputShape } from '../utils/inputShapeResolver';
import { RequestSearchPalette } from './RequestSearchPalette';
import type { StitchNode, RequestNodeConfig, StitchAuthConfig } from '@/types/stitch';
import type { KeyValueRow } from '@/stores/requestStore';
import type { KeyValuePair, Request } from '@/lib/db';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const BODY_TYPES = ['none', 'json', 'text', 'xml'] as const;
const AUTH_TYPES = ['none', 'bearer', 'basic', 'api-key'] as const;
type EditorTab = 'headers' | 'params' | 'body' | 'auth';

interface RequestNodeEditorProps {
  node: StitchNode;
}

function mapBodyType(bt: string): RequestNodeConfig['bodyType'] {
  if (bt === 'json' || bt === 'xml') return bt;
  if (bt === 'raw') return 'text';
  return 'none';
}

function mapAuth(authType: string, authConfig: Record<string, string>): StitchAuthConfig {
  switch (authType) {
    case 'bearer': return { type: 'bearer', token: authConfig['token'] ?? '' };
    case 'basic': return { type: 'basic', username: authConfig['username'] ?? '', password: authConfig['password'] ?? '' };
    case 'api-key': return { type: 'api-key', key: authConfig['key'] ?? '', value: authConfig['value'] ?? '', in: (authConfig['in'] as 'header' | 'query') ?? 'header' };
    default: return { type: 'none' };
  }
}

export function RequestNodeEditor({ node }: RequestNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const connections = useStitchStore((s) => s.connections);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const environments = useEnvironmentStore((s) => s.environments);
  const [activeTab, setActiveTab] = useState<EditorTab>('headers');
  const [showSearch, setShowSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const cfg = node.config as unknown as RequestNodeConfig;
  const method = cfg.method ?? 'GET';
  const storeUrl = cfg.url ?? '';
  const [localUrl, setLocalUrl] = useState(storeUrl);
  useEffect(() => { setLocalUrl(storeUrl); }, [storeUrl]);
  const headers: KeyValueRow[] = cfg.headers ?? [];
  const queryParams: KeyValueRow[] = cfg.queryParams ?? [];
  const body = cfg.body ?? '';
  const bodyType = cfg.bodyType ?? 'none';
  const auth: StitchAuthConfig = cfg.auth ?? { type: 'none' };

  // Combine env variables + connected input keys for variable highlighting
  const activeEnv = environments.find((e) => e.is_active);
  const inputKeys = useMemo(() => resolveInputShape(node.id, connections), [node.id, connections]);
  const availableVariables: KeyValuePair[] = useMemo(() => {
    const envVars: KeyValuePair[] = activeEnv?.variables ?? [];
    const inputVars: KeyValuePair[] = inputKeys.map((k) => ({ key: k, value: '', enabled: true }));
    return [...inputVars, ...envVars];
  }, [activeEnv, inputKeys]);

  const persist = useCallback(
    (changes: Partial<RequestNodeConfig>): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
      }, 300);
    },
    [node.id, node.config, updateNode],
  );

  const persistImmediate = useCallback(
    (changes: Partial<RequestNodeConfig>): void => {
      updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  const handleImportRequest = useCallback(
    (req: Request): void => {
      persistImmediate({
        method: req.method,
        url: req.url,
        headers: req.headers.map((h) => ({ key: h.key, value: h.value, enabled: h.enabled })),
        queryParams: req.query_params.map((q) => ({ key: q.key, value: q.value, enabled: q.enabled })),
        body: req.body_content,
        bodyType: mapBodyType(req.body_type),
        auth: mapAuth(req.auth_type, req.auth_config),
      });
      updateNode(node.id, { label: req.name }).catch(() => {});
      setShowSearch(false);
    },
    [persistImmediate, updateNode, node.id],
  );

  // KeyValueRows callbacks for headers
  const onAddHeader = useCallback((): void => {
    persistImmediate({ headers: [...headers, { key: '', value: '', enabled: true }] });
  }, [headers, persistImmediate]);
  const onUpdateHeader = useCallback((i: number, field: 'key' | 'value', val: string): void => {
    const updated = headers.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    persistImmediate({ headers: updated });
  }, [headers, persistImmediate]);
  const onToggleHeader = useCallback((i: number): void => {
    const updated = headers.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r));
    persistImmediate({ headers: updated });
  }, [headers, persistImmediate]);
  const onRemoveHeader = useCallback((i: number): void => {
    persistImmediate({ headers: headers.filter((_, idx) => idx !== i) });
  }, [headers, persistImmediate]);

  // KeyValueRows callbacks for query params
  const onAddParam = useCallback((): void => {
    persistImmediate({ queryParams: [...queryParams, { key: '', value: '', enabled: true }] });
  }, [queryParams, persistImmediate]);
  const onUpdateParam = useCallback((i: number, field: 'key' | 'value', val: string): void => {
    const updated = queryParams.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    persistImmediate({ queryParams: updated });
  }, [queryParams, persistImmediate]);
  const onToggleParam = useCallback((i: number): void => {
    const updated = queryParams.map((r, idx) => (idx === i ? { ...r, enabled: !r.enabled } : r));
    persistImmediate({ queryParams: updated });
  }, [queryParams, persistImmediate]);
  const onRemoveParam = useCallback((i: number): void => {
    persistImmediate({ queryParams: queryParams.filter((_, idx) => idx !== i) });
  }, [queryParams, persistImmediate]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Search palette overlay */}
      {showSearch && (
        <div className="shrink-0 border-b border-app-subtle">
          <RequestSearchPalette
            onSelect={handleImportRequest}
            onClose={() => setShowSearch(false)}
          />
        </div>
      )}

      {/* Collections + Method + URL row */}
      <div className="grid shrink-0 grid-cols-[auto_7rem_1fr] items-end gap-3 border-b border-app-subtle px-3 py-2">
        <div>
          <label className="text-app-secondary mb-1 block text-xs font-medium">Collections</label>
          <button
            className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-app-subtle px-3 text-xs text-app-muted transition-colors hover:bg-blue-500/15 hover:text-app-primary"
            onClick={() => setShowSearch(true)}
            title="Import from collection"
            data-testid="import-request-btn"
          >
            <Import size={13} />
            Import
          </button>
        </div>
        <div>
          <label htmlFor={`stitch-method-${node.id}`} className="text-app-secondary mb-1 block text-xs font-medium">Method</label>
          <select
            id={`stitch-method-${node.id}`}
            className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm"
            value={method}
            onChange={(e) => persistImmediate({ method: e.target.value })}
            data-testid="request-method"
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`stitch-url-${node.id}`} className="text-app-secondary mb-1 block text-xs font-medium">URL</label>
          <HighlightedUrlInput
            id={`stitch-url-${node.id}`}
            value={localUrl}
            onChange={(v) => { setLocalUrl(v); persist({ url: v }); }}
            placeholder="https://api.example.com/{{path}}"
            variables={availableVariables}
          />
        </div>
      </div>

      {/* Tabs — matches Fetch tab styling */}
      <div className="shrink-0 border-b border-app-subtle">
        <div className="flex gap-2 px-2">
          {(['headers', 'params', 'body', 'auth'] as const).map((tab) => {
            const isActive = activeTab === tab;
            const label = tab === 'params' ? 'Query Params' : tab.charAt(0).toUpperCase() + tab.slice(1);
            return (
              <button
                key={tab}
                type="button"
                className={`cursor-pointer rounded-t-md px-3 py-2 text-sm ${
                  isActive
                    ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                    : 'text-app-muted hover:text-app-primary'
                }`}
                onClick={() => setActiveTab(tab)}
                data-testid={`tab-${tab}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {activeTab === 'headers' && (
          <KeyValueRows
            sectionName="headers"
            rows={headers}
            addLabel="Add Header"
            onAdd={onAddHeader}
            onUpdate={onUpdateHeader}
            onToggleEnabled={onToggleHeader}
            onRemove={onRemoveHeader}
            activeVariables={availableVariables}
          />
        )}
        {activeTab === 'params' && (
          <KeyValueRows
            sectionName="query"
            rows={queryParams}
            addLabel="Add Query Param"
            onAdd={onAddParam}
            onUpdate={onUpdateParam}
            onToggleEnabled={onToggleParam}
            onRemove={onRemoveParam}
            activeVariables={availableVariables}
          />
        )}
        {activeTab === 'body' && (
          <div className="flex min-h-0 flex-1 flex-col space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-app-secondary block text-sm font-medium">Request Body</label>
              <select
                aria-label="Request Body Language"
                value={bodyType}
                onChange={(e) => persistImmediate({ bodyType: e.target.value as RequestNodeConfig['bodyType'] })}
                className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
                data-testid="body-type-select"
              >
                {BODY_TYPES.map((bt) => (
                  <option key={bt} value={bt}>{bt.toUpperCase()}</option>
                ))}
              </select>
            </div>
            {bodyType !== 'none' && (
              <MonacoEditorField
                value={body}
                language={bodyType === 'json' ? 'json' : bodyType === 'xml' ? 'xml' : 'plaintext'}
                fontSize={fontSize}
                path={`stitch-req-body-${node.id}`}
                testId="request-body-editor"
                height="100%"
                onChange={(v) => persist({ body: v })}
              />
            )}
          </div>
        )}
        {activeTab === 'auth' && (
          <div className="space-y-3">
            <div>
              <label className="text-app-secondary mb-1 block text-xs font-medium">Auth Type</label>
              <select
                className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-48 rounded-md border pl-2 pr-7 text-xs"
                value={auth.type}
                onChange={(e) => {
                  const t = e.target.value as StitchAuthConfig['type'];
                  if (t === 'none') persistImmediate({ auth: { type: 'none' } });
                  else if (t === 'bearer') persistImmediate({ auth: { type: 'bearer', token: '' } });
                  else if (t === 'basic') persistImmediate({ auth: { type: 'basic', username: '', password: '' } });
                  else if (t === 'api-key') persistImmediate({ auth: { type: 'api-key', key: '', value: '', in: 'header' } });
                }}
                data-testid="auth-type-select"
              >
                {AUTH_TYPES.map((t) => (
                  <option key={t} value={t}>{t === 'none' ? 'None' : t === 'bearer' ? 'Bearer Token' : t === 'basic' ? 'Basic Auth' : 'API Key'}</option>
                ))}
              </select>
            </div>

            {auth.type === 'bearer' && (
              <div>
                <label className="text-app-secondary mb-1 block text-xs font-medium">Token</label>
                <input
                  type="text"
                  className="h-8 w-full rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
                  value={auth.token}
                  onChange={(e) => persistImmediate({ auth: { ...auth, token: e.target.value } })}
                  placeholder="{{token}}"
                  data-testid="auth-bearer-token"
                />
              </div>
            )}

            {auth.type === 'basic' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-app-secondary mb-1 block text-xs font-medium">Username</label>
                  <input
                    type="text"
                    className="h-8 w-full rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
                    value={auth.username}
                    onChange={(e) => persistImmediate({ auth: { ...auth, username: e.target.value } })}
                    placeholder="{{username}}"
                    data-testid="auth-basic-username"
                  />
                </div>
                <div>
                  <label className="text-app-secondary mb-1 block text-xs font-medium">Password</label>
                  <input
                    type="password"
                    className="h-8 w-full rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
                    value={auth.password}
                    onChange={(e) => persistImmediate({ auth: { ...auth, password: e.target.value } })}
                    placeholder="{{password}}"
                    data-testid="auth-basic-password"
                  />
                </div>
              </div>
            )}

            {auth.type === 'api-key' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-app-secondary mb-1 block text-xs font-medium">Key</label>
                    <input
                      type="text"
                      className="h-8 w-full rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
                      value={auth.key}
                      onChange={(e) => persistImmediate({ auth: { ...auth, key: e.target.value } })}
                      placeholder="X-API-Key"
                      data-testid="auth-apikey-key"
                    />
                  </div>
                  <div>
                    <label className="text-app-secondary mb-1 block text-xs font-medium">Value</label>
                    <input
                      type="text"
                      className="h-8 w-full rounded-md border border-app-subtle bg-app-main px-2 text-sm text-app-primary"
                      value={auth.value}
                      onChange={(e) => persistImmediate({ auth: { ...auth, value: e.target.value } })}
                      placeholder="{{api_key}}"
                      data-testid="auth-apikey-value"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-app-secondary mb-1 block text-xs font-medium">Send In</label>
                  <select
                    className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-32 rounded-md border pl-2 pr-7 text-xs"
                    value={auth.in}
                    onChange={(e) => persistImmediate({ auth: { ...auth, in: e.target.value as 'header' | 'query' } })}
                    data-testid="auth-apikey-in"
                  >
                    <option value="header">Header</option>
                    <option value="query">Query Param</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
