import { useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { useStitchStore } from '@/stores/stitchStore';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import type { StitchNode, MappingExitNodeConfig } from '@/types/stitch';

interface MappingExitNodeEditorProps {
  node: StitchNode;
}

export function MappingExitNodeEditor({ node }: MappingExitNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const config = node.config as unknown as MappingExitNodeConfig;

  const update = useCallback(
    (changes: Partial<MappingExitNodeConfig>): void => {
      updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  const headers = config.headers ?? [];

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

  return (
    <div className="flex h-full flex-col overflow-y-auto" data-testid="mapping-exit-editor">
      {/* Status */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <label className="mb-1 block text-xs font-medium text-app-muted">Status Code</label>
        <input
          type="number"
          className="w-24 rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none focus:border-teal-500"
          value={config.status ?? 200}
          onChange={(e) => update({ status: parseInt(e.target.value, 10) || 200 })}
          data-testid="exit-status-input"
        />
      </div>

      {/* Headers */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-app-muted">Response Headers</label>
          <button
            className="rounded p-0.5 text-teal-500 hover:bg-app-hover"
            onClick={handleAddHeader}
            title="Add header"
          >
            <Plus size={12} />
          </button>
        </div>
        {headers.length === 0 && (
          <p className="text-[10px] text-app-muted">No headers configured</p>
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
                placeholder="Value (supports {{key}})"
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

      {/* Content Type */}
      <div className="shrink-0 border-b border-app-subtle px-3 py-2">
        <label className="mb-1 block text-xs font-medium text-app-muted">Content Type</label>
        <input
          className="w-full rounded border border-app-subtle bg-app-main px-2 py-1 text-xs text-app-primary outline-none"
          value={config.bodyContentType ?? 'application/json'}
          onChange={(e) => update({ bodyContentType: e.target.value })}
        />
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 px-3 py-2">
        <label className="mb-1 block text-xs font-medium text-app-muted">Response Body</label>
        <p className="mb-1 text-[9px] text-app-muted">Supports <code className="text-teal-400">{'{{key}}'}</code> interpolation from input</p>
        <MonacoEditorField
          value={config.body ?? ''}
          language="json"
          fontSize={fontSize}
          path={`mapping-exit-body-${node.id}`}
          testId="exit-body-editor"
          height="100%"
          onChange={(val) => update({ body: val })}
        />
      </div>
    </div>
  );
}
