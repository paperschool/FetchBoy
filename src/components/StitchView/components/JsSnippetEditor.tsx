import { useCallback, useRef, useMemo } from 'react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { extractReturnKeys } from '../utils/jsKeyExtractor';
import type { StitchNode, StitchConnection } from '@/types/stitch';

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

  const executionNodeOutputs = useStitchStore((s) => s.executionNodeOutputs);

  const inputEntries = useMemo((): Array<{ key: string; type: string }> => {
    const incoming = connections.filter(
      (c: StitchConnection) => c.targetNodeId === node.id,
    );
    const entries: Array<{ key: string; type: string }> = [];
    for (const c of incoming) {
      const sourceOutput = executionNodeOutputs[c.sourceNodeId];
      if (c.sourceKey !== null) {
        // Keyed connection — single key
        let type = '?';
        if (sourceOutput && c.sourceKey in sourceOutput) {
          const val = sourceOutput[c.sourceKey];
          if (val === null) type = 'null';
          else if (Array.isArray(val)) type = 'array';
          else type = typeof val;
        }
        entries.push({ key: c.sourceKey, type });
      } else if (sourceOutput) {
        // Null key — spread all keys from source output
        for (const key of Object.keys(sourceOutput)) {
          const val = sourceOutput[key];
          let type = '?';
          if (val === null) type = 'null';
          else if (Array.isArray(val)) type = 'array';
          else type = typeof val;
          entries.push({ key, type });
        }
      }
    }

    // Loop entry snippets always receive { element, index } from the loop
    const cfg = node.config as { isLoopEntry?: boolean };
    if (cfg.isLoopEntry && entries.length === 0) {
      entries.push({ key: 'element', type: '?' });
      entries.push({ key: 'index', type: 'number' });
    }

    return entries;
  }, [node.id, node.config, connections, executionNodeOutputs]);

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
              {inputEntries.length === 0 ? (
                <span className="text-[10px] text-app-muted">No input connected</span>
              ) : (
                inputEntries.map(({ key, type }) => (
                  <button
                    key={key}
                    className="flex cursor-pointer items-center gap-0.5 rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] text-blue-700 hover:bg-blue-500/30 dark:text-blue-400"
                    data-testid={`input-key-${key}`}
                    onClick={() => handleInjectKey(key)}
                    title={`Insert const ${key} = input.${key};`}
                  >
                    {key}
                    {type !== '?' && (
                      <span className={`ml-0.5 rounded px-0.5 text-[8px] font-medium ${
                        type === 'object' ? 'bg-purple-500/20 text-purple-400'
                        : type === 'array' ? 'bg-purple-500/20 text-purple-400'
                        : type === 'string' ? 'bg-green-500/20 text-green-400'
                        : type === 'number' ? 'bg-orange-500/20 text-orange-400'
                        : type === 'boolean' ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {type === 'object' ? 'json' : type}
                      </span>
                    )}
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
