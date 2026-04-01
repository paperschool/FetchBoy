import { useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, MappingExitNodeConfig } from '@/types/stitch';

interface MappingExitNodeEditorProps {
  node: StitchNode;
}

export function MappingExitNodeEditor({ node }: MappingExitNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const config = node.config as unknown as MappingExitNodeConfig;

  const update = useCallback(
    (changes: Partial<MappingExitNodeConfig>): void => {
      updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  const headers = config.headers ?? [];
  const cookies = config.cookies ?? [];

  const handleAddHeader = useCallback((): void => {
    update({ headers: [...headers, { key: '', value: '' }] });
  }, [headers, update]);

  const handleRemoveHeader = useCallback(
    (idx: number): void => {
      update({ headers: headers.filter((_, i) => i !== idx) });
    },
    [headers, update],
  );

  const handleHeaderChange = useCallback(
    (idx: number, field: 'key' | 'value', val: string): void => {
      const next = headers.map((h, i) => (i === idx ? { ...h, [field]: val } : h));
      update({ headers: next });
    },
    [headers, update],
  );

  const handleAddCookie = useCallback((): void => {
    update({ cookies: [...cookies, { key: '', value: '' }] });
  }, [cookies, update]);

  const handleRemoveCookie = useCallback(
    (idx: number): void => {
      update({ cookies: cookies.filter((_, i) => i !== idx) });
    },
    [cookies, update],
  );

  const handleCookieChange = useCallback(
    (idx: number, field: 'key' | 'value', val: string): void => {
      const next = cookies.map((c, i) => (i === idx ? { ...c, [field]: val } : c));
      update({ cookies: next });
    },
    [cookies, update],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto" data-testid="mapping-exit-editor">
      {/* Info */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <p className="text-[10px] text-app-muted">
          The exit node passes through values from its input ports. Use JS Snippet nodes to transform data before wiring it here.
          Fallback values below are used when an input port has no connection.
        </p>
      </div>

      {/* Status */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <label className="mb-1 block text-xs font-medium text-app-muted">Fallback Status Code</label>
        <input
          type="number"
          className="w-24 rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none focus:border-yellow-500"
          value={config.status ?? 200}
          onChange={(e) => update({ status: parseInt(e.target.value, 10) || 200 })}
          data-testid="exit-status-input"
        />
      </div>

      {/* Fallback Headers */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-app-muted">Fallback Headers</label>
          <button
            className="rounded p-0.5 text-yellow-500 hover:bg-app-hover"
            onClick={handleAddHeader}
            title="Add header"
          >
            <Plus size={12} />
          </button>
        </div>
        {headers.length === 0 && (
          <p className="text-[10px] text-app-muted">No fallback headers</p>
        )}
        <div className="space-y-1">
          {headers.map((h, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1.5 py-0.5 text-[10px] text-app-primary outline-none"
                placeholder="Header name"
                value={h.key}
                onChange={(e) => handleHeaderChange(i, 'key', e.target.value)}
              />
              <input
                className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1.5 py-0.5 text-[10px] text-app-primary outline-none"
                placeholder="Value"
                value={h.value}
                onChange={(e) => handleHeaderChange(i, 'value', e.target.value)}
              />
              <button className="text-red-400 hover:text-red-300" onClick={() => handleRemoveHeader(i)}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Fallback Cookies */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-app-muted">Fallback Set-Cookie</label>
          <button
            className="rounded p-0.5 text-yellow-500 hover:bg-app-hover"
            onClick={handleAddCookie}
            title="Add cookie"
          >
            <Plus size={12} />
          </button>
        </div>
        {cookies.length === 0 && (
          <p className="text-[10px] text-app-muted">No fallback cookies</p>
        )}
        <div className="space-y-1">
          {cookies.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <input
                className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1.5 py-0.5 text-[10px] text-app-primary outline-none"
                placeholder="Cookie name"
                value={c.key}
                onChange={(e) => handleCookieChange(i, 'key', e.target.value)}
              />
              <input
                className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1.5 py-0.5 text-[10px] text-app-primary outline-none"
                placeholder="Value"
                value={c.value}
                onChange={(e) => handleCookieChange(i, 'value', e.target.value)}
              />
              <button className="text-red-400 hover:text-red-300" onClick={() => handleRemoveCookie(i)}>
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Content Type */}
      <div className="shrink-0 px-3 py-2">
        <label className="mb-1 block text-xs font-medium text-app-muted">Content Type</label>
        <input
          className="w-full rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none"
          value={config.bodyContentType ?? 'application/json'}
          onChange={(e) => update({ bodyContentType: e.target.value })}
        />
      </div>
    </div>
  );
}
