import { useCallback, useRef, useMemo } from 'react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { extractJsonKeys } from '../utils/jsonKeyExtractor';
import type { StitchNode } from '@/types/stitch';

interface JsonObjectEditorProps {
  node: StitchNode;
}

export function JsonObjectEditor({ node }: JsonObjectEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const jsonValue = (node.config as { json?: string }).json ?? '';

  const { keys, error } = useMemo(() => extractJsonKeys(jsonValue), [jsonValue]);

  const handleChange = useCallback(
    (value: string): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode(node.id, { config: { ...node.config, json: value } }).catch(() => {});
      }, 300);
    },
    [node.id, node.config, updateNode],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-xs font-medium text-app-primary">
          JSON Object — {node.label ?? 'Untitled'}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <MonacoEditorField
          value={jsonValue}
          language="json"
          fontSize={fontSize}
          path={`stitch-json-${node.id}`}
          testId="json-object-editor"
          height="100%"
          onChange={handleChange}
        />
      </div>

      <div className="shrink-0 border-t border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-app-muted">
          Exports
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {error ? (
            <span className="text-xs text-red-500" data-testid="editor-json-error">{error}</span>
          ) : keys.length === 0 ? (
            <span className="text-xs text-app-muted">No keys</span>
          ) : (
            keys.map((key) => (
              <span
                key={key}
                className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] text-green-700 dark:text-green-400"
                data-testid={`export-key-${key}`}
              >
                {key}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
