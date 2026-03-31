import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import type { StitchNode } from '@/types/stitch';

interface ConditionNodeEditorProps {
  node: StitchNode;
}

export function ConditionNodeEditor({ node }: ConditionNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);
  const fontSize = useUiSettingsStore((s) => s.editorFontSize);
  const config = node.config as { expression?: string };
  const expression = config.expression ?? 'input.status === 200';

  const handleChange = useCallback(
    (value: string): void => {
      updateNode(node.id, { config: { ...node.config, expression: value } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  return (
    <div className="flex h-full flex-col" data-testid="condition-node-editor">
      <div className="shrink-0 px-3 py-2">
        <p className="text-[10px] text-app-muted">
          JS expression evaluated against <code className="text-orange-400">input</code>. Must return truthy/falsy.
        </p>
      </div>
      <div className="min-h-0 flex-1 px-3 pb-2">
        <MonacoEditorField
          value={expression}
          language="javascript"
          fontSize={fontSize}
          path={`condition-${node.id}`}
          testId="condition-expression-editor"
          height="100%"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
