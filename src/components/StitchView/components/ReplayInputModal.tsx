import { useState, useCallback } from 'react';
import { X, Play } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { t } from '@/lib/i18n';

interface ReplayInputModalProps {
  nodeLabel: string;
  originalInput: unknown;
  onRun: (input: unknown) => void;
  onClose: () => void;
}

export function ReplayInputModal({
  nodeLabel,
  originalInput,
  onRun,
  onClose,
}: ReplayInputModalProps): React.ReactElement {
  const [value, setValue] = useState(() => JSON.stringify(originalInput ?? {}, null, 2));
  const [parseError, setParseError] = useState<string | null>(null);

  const handleRun = useCallback(() => {
    try {
      const parsed = JSON.parse(value);
      setParseError(null);
      onRun(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  }, [value, onRun]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="replay-input-modal">
      <div className="mx-4 flex w-full max-w-lg flex-col rounded-lg border border-app-subtle bg-app-main shadow-xl" style={{ height: 400 }}>
        <div className="flex shrink-0 items-center justify-between border-b border-app-subtle px-4 py-2">
          <span className="text-sm font-medium text-app-primary">
            Replay: {nodeLabel} — Custom Input
          </span>
          <button onClick={onClose} className="cursor-pointer rounded p-1 text-app-muted hover:text-app-secondary">
            <X size={14} />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <MonacoEditorField
            value={value}
            language="json"
            onChange={setValue}
            fontSize={12}
            path="replay-custom-input"
            testId="replay-input-editor"
            height="100%"
          />
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-app-subtle px-4 py-2">
          {parseError ? (
            <span className="text-xs text-red-400">{parseError}</span>
          ) : (
            <span className="text-xs text-app-muted">Edit JSON input, then click Run</span>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="cursor-pointer rounded px-3 py-1.5 text-xs text-app-secondary hover:bg-app-hover"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleRun}
              className="flex cursor-pointer items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-500"
            >
              <Play size={11} /> Run
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
