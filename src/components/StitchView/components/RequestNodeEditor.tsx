import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { HighlightedUrlInput } from '@/components/MainPanel/HighlightedUrlInput';
import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { useEnvironmentStore } from '@/stores/environmentStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { resolveInputShape } from '../utils/inputShapeResolver';
import type { StitchNode, RequestNodeConfig } from '@/types/stitch';
import type { KeyValueRow } from '@/stores/requestStore';
import type { KeyValuePair, Request } from '@/lib/db';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
const BODY_TYPES = ['none', 'json', 'text', 'xml'] as const;
type EditorTab = 'headers' | 'params' | 'body';

interface RequestNodeEditorProps {
  node: StitchNode;
}

function mapBodyType(bt: string): RequestNodeConfig['bodyType'] {
  if (bt === 'json' || bt === 'xml') return bt;
  if (bt === 'raw') return 'text';
  return 'none';
}

export function RequestNodeEditor({ node }: RequestNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const connections = useStitchStore((s) => s.connections);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const environments = useEnvironmentStore((s) => s.environments);
  const collections = useCollectionStore((s) => s.collections);
  const folders = useCollectionStore((s) => s.folders);
  const savedRequests = useCollectionStore((s) => s.requests);
  const [activeTab, setActiveTab] = useState<EditorTab>('headers');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = node.config as unknown as RequestNodeConfig;
  const method = cfg.method ?? 'GET';
  const storeUrl = cfg.url ?? '';
  const [localUrl, setLocalUrl] = useState(storeUrl);
  useEffect(() => { setLocalUrl(storeUrl); }, [storeUrl]);
  const headers: KeyValueRow[] = cfg.headers ?? [];
  const queryParams: KeyValueRow[] = cfg.queryParams ?? [];
  const body = cfg.body ?? '';
  const bodyType = cfg.bodyType ?? 'none';

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

  const handleLoadFromCollection = useCallback(
    (requestId: string): void => {
      const req: Request | undefined = savedRequests.find((r) => r.id === requestId);
      if (!req) return;
      persistImmediate({
        method: req.method,
        url: req.url,
        headers: req.headers.map((h) => ({ key: h.key, value: h.value, enabled: h.enabled })),
        queryParams: req.query_params.map((q) => ({ key: q.key, value: q.value, enabled: q.enabled })),
        body: req.body_content,
        bodyType: mapBodyType(req.body_type),
      });
      updateNode(node.id, { label: req.name }).catch(() => {});
    },
    [savedRequests, persistImmediate, updateNode, node.id],
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
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-xs font-medium text-app-primary">
          Request — {node.label ?? 'Untitled'}
        </span>
        {savedRequests.length > 0 && (
          <select
            className="select-flat border-app-subtle bg-app-main text-app-muted h-6 max-w-[14rem] rounded border pl-1.5 pr-5 text-[10px]"
            value=""
            onChange={(e) => { if (e.target.value) handleLoadFromCollection(e.target.value); }}
            data-testid="load-from-collection"
          >
            <option value="">Load from collection...</option>
            {collections.map((col) => {
              const colFolders = folders.filter((f) => f.collection_id === col.id);
              const rootRequests = savedRequests.filter((r) => r.collection_id === col.id && !r.folder_id);
              const hasContent = rootRequests.length > 0 || colFolders.some((f) => savedRequests.some((r) => r.folder_id === f.id));
              if (!hasContent) return null;
              return (
                <optgroup key={col.id} label={col.name}>
                  {rootRequests.map((r) => (
                    <option key={r.id} value={r.id}>{r.method} {r.name}</option>
                  ))}
                  {colFolders.map((f) => {
                    const folderReqs = savedRequests.filter((r) => r.folder_id === f.id);
                    return folderReqs.map((r) => (
                      <option key={r.id} value={r.id}>{r.method} {f.name} / {r.name}</option>
                    ));
                  })}
                </optgroup>
              );
            })}
          </select>
        )}
      </div>

      {/* Method + URL row — matches Fetch tab layout */}
      <div className="grid shrink-0 grid-cols-[8rem_1fr] items-start gap-3 border-b border-app-subtle px-3 py-2">
        <div>
          <label htmlFor={`stitch-method-${node.id}`} className="text-app-secondary mb-1 block text-xs font-medium">HTTP Method</label>
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
          <label htmlFor={`stitch-url-${node.id}`} className="text-app-secondary mb-1 block text-xs font-medium">Request URL</label>
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
          {(['headers', 'params', 'body'] as const).map((tab) => {
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
      </div>
    </div>
  );
}
