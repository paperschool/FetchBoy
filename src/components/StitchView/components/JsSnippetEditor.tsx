import { useCallback, useRef, useMemo } from 'react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { extractReturnKeys } from '../utils/jsKeyExtractor';
import { resolveInputShape } from '../utils/inputShapeResolver';
import type { StitchNode } from '@/types/stitch';

interface JsSnippetEditorProps {
  node: StitchNode;
}

export function JsSnippetEditor({ node }: JsSnippetEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const connections = useStitchStore((s) => s.connections);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const codeValue = (node.config as { code?: string }).code ?? '';

  const { keys, error } = useMemo(() => extractReturnKeys(codeValue), [codeValue]);

  const inputKeys = useMemo(
    () => resolveInputShape(node.id, connections),
    [node.id, connections],
  );

  const inputShapeText = inputKeys.length > 0
    ? `// Available input: { ${inputKeys.join(', ')} }`
    : '// No input connected';

  const handleChange = useCallback(
    (value: string): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode(node.id, { config: { ...node.config, code: value } }).catch(() => {});
      }, 300);
    },
    [node.id, node.config, updateNode],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-xs font-medium text-app-primary">
          JS Snippet — {node.label ?? 'Untitled'}
        </span>
      </div>

      {/* Input shape bar */}
      <div className="shrink-0 border-b border-app-subtle bg-app-sidebar/50 px-3 py-1" data-testid="input-shape-bar">
        <code className="text-[10px] text-app-muted">{inputShapeText}</code>
      </div>

      {/* Monaco editor */}
      <div className="min-h-0 flex-1">
        <MonacoEditorField
          value={codeValue}
          language="javascript"
          fontSize={fontSize}
          path={`stitch-js-${node.id}`}
          testId="js-snippet-editor"
          height="100%"
          onChange={handleChange}
        />
      </div>

      {/* Exports bar */}
      <div className="shrink-0 border-t border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-app-muted">
          Exports
        </span>
        <div className="mt-1 flex flex-wrap gap-1">
          {error ? (
            <span className="text-xs text-red-500" data-testid="editor-js-error">{error}</span>
          ) : keys.length === 0 ? (
            <span className="text-xs text-app-muted">No exports detected</span>
          ) : (
            keys.map((key) => (
              <span
                key={key}
                className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400"
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
