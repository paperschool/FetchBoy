import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, SleepNodeConfig } from '@/types/stitch';

const MAX_DURATION = 60000;

interface SleepNodeEditorProps {
  node: StitchNode;
}

export function SleepNodeEditor({ node }: SleepNodeEditorProps): React.ReactElement {
  const updateNode = useStitchStore((s) => s.updateNode);

  const cfg = node.config as unknown as SleepNodeConfig;
  const mode = cfg.mode ?? 'fixed';
  const durationMs = cfg.durationMs ?? 1000;
  const minMs = cfg.minMs ?? 500;
  const maxMs = cfg.maxMs ?? 2000;

  const persist = useCallback(
    (changes: Partial<SleepNodeConfig>): void => {
      updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
    },
    [node.id, node.config, updateNode],
  );

  const clamp = (val: number): number => Math.max(0, Math.min(MAX_DURATION, Math.round(val)));

  const minMaxError = mode === 'random' && minMs > maxMs ? 'Min must be ≤ Max' : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-app-subtle bg-app-sidebar px-3 py-1.5">
        <span className="text-xs font-medium text-app-primary">
          Sleep — {node.label ?? 'Untitled'}
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto p-4">
        {/* Mode toggle */}
        <div className="mb-4">
          <label className="text-app-secondary mb-1.5 block text-xs font-medium">Mode</label>
          <div className="flex gap-1">
            {(['fixed', 'random'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
                  mode === m
                    ? 'border-purple-500 bg-purple-500/15 text-purple-500'
                    : 'border-app-subtle text-app-muted hover:text-app-primary'
                }`}
                onClick={() => persist({ mode: m })}
                data-testid={`mode-${m}`}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {mode === 'fixed' ? (
          <div>
            <label htmlFor={`sleep-duration-${node.id}`} className="text-app-secondary mb-1.5 block text-xs font-medium">Duration (ms)</label>
            <input
              id={`sleep-duration-${node.id}`}
              type="number"
              min={0}
              max={MAX_DURATION}
              step={100}
              value={durationMs}
              onChange={(e) => persist({ durationMs: clamp(Number(e.target.value)) })}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-40 rounded-md border px-2 text-sm"
              data-testid="duration-input"
            />
          </div>
        ) : (
          <div className="flex items-start gap-4">
            <div>
              <label htmlFor={`sleep-min-${node.id}`} className="text-app-secondary mb-1.5 block text-xs font-medium">Min (ms)</label>
              <input
                id={`sleep-min-${node.id}`}
                type="number"
                min={0}
                max={MAX_DURATION}
                step={100}
                value={minMs}
                onChange={(e) => persist({ minMs: clamp(Number(e.target.value)) })}
                className={`border-app-subtle bg-app-main text-app-primary h-9 w-32 rounded-md border px-2 text-sm ${minMaxError ? 'ring-1 ring-red-500' : ''}`}
                data-testid="min-input"
              />
            </div>
            <div>
              <label htmlFor={`sleep-max-${node.id}`} className="text-app-secondary mb-1.5 block text-xs font-medium">Max (ms)</label>
              <input
                id={`sleep-max-${node.id}`}
                type="number"
                min={0}
                max={MAX_DURATION}
                step={100}
                value={maxMs}
                onChange={(e) => persist({ maxMs: clamp(Number(e.target.value)) })}
                className={`border-app-subtle bg-app-main text-app-primary h-9 w-32 rounded-md border px-2 text-sm ${minMaxError ? 'ring-1 ring-red-500' : ''}`}
                data-testid="max-input"
              />
            </div>
          </div>
        )}

        {minMaxError && (
          <p className="mt-2 text-xs text-red-500" data-testid="validation-error">{minMaxError}</p>
        )}

        {(durationMs > MAX_DURATION || minMs > MAX_DURATION || maxMs > MAX_DURATION) && (
          <p className="mt-2 text-xs text-orange-400">Max recommended duration is {MAX_DURATION}ms (1 minute)</p>
        )}
      </div>
    </div>
  );
}
