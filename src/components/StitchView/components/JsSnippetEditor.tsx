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

  const handleChange = useCallback(
    (value: string): void => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateNode(node.id, { config: { ...node.config, code: value } }).catch(() => {});
      }, 300);
    },
    [node.id, node.config, updateNode],
  );

  const handleInjectKey = useCallback(
    (key: string): void => {
      const line = `const ${key} = input.${key};\n`;
      if (codeValue.includes(line.trim())) return; // already present
      const newCode = line + codeValue;
      updateNode(node.id, { config: { ...node.config, code: newCode } }).catch(() => {});
    },
    [codeValue, node.id, node.config, updateNode],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Main content: sidebar + editor */}
      <div className="flex min-h-0 flex-1">
        {/* Inputs & Exports sidebar */}
        <div className="flex w-36 shrink-0 flex-col gap-3 overflow-y-auto border-r border-app-subtle bg-app-sidebar p-3">
          {/* Inputs */}
          <div data-testid="input-shape-bar">
            <span className="text-[10px] font-medium uppercase tracking-wider text-app-muted">
              Inputs
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {inputKeys.length === 0 ? (
                <span className="text-[10px] text-app-muted">No input connected</span>
              ) : (
                inputKeys.map((key) => (
                  <button
                    key={key}
                    className="cursor-pointer rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-500/30 dark:text-blue-400"
                    data-testid={`input-key-${key}`}
                    onClick={() => handleInjectKey(key)}
                    title={`Insert const ${key} = input.${key};`}
                  >
                    {key}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Exports */}
          <div>
            <span className="text-[10px] font-medium uppercase tracking-wider text-app-muted">
              Exports
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {error ? (
                <span className="text-[10px] text-red-500" data-testid="editor-js-error">{error}</span>
              ) : keys.length === 0 ? (
                <span className="text-[10px] text-app-muted">No exports detected</span>
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

        {/* Monaco editor */}
        <div className="min-h-0 min-w-0 flex-1">
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
      </div>
    </div>
  );
}
