import { useCallback } from 'react';
import { useStitchStore } from '@/stores/stitchStore';
import type { StitchNode, SleepNodeConfig } from '@/types/stitch';

const MAX_DURATION = 60000;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  return sec === Math.floor(sec) ? `${sec} second${sec === 1 ? '' : 's'}` : `${sec.toFixed(1)} seconds`;
}

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

  const clamp = (val: number): number => {
    const n = Number(val);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(MAX_DURATION, Math.round(n)));
  };

  const persist = useCallback(
    (changes: Partial<SleepNodeConfig>): void => {
      const merged = { ...cfg, ...changes };
      // Enforce min <= max before persisting (AC: validation)
      if (merged.mode === 'random' && (merged.minMs ?? 0) > (merged.maxMs ?? 0)) {
        // Swap min/max to auto-correct
        const corrected = { ...changes, minMs: merged.maxMs, maxMs: merged.minMs };
        updateNode(node.id, { config: { ...node.config, ...corrected } }).catch(() => {});
        return;
      }
      updateNode(node.id, { config: { ...node.config, ...changes } }).catch(() => {});
    },
    [node.id, node.config, cfg, updateNode],
  );

  const minMaxError = mode === 'random' && minMs > maxMs ? 'Min must be ≤ Max' : null;
  const humanDuration = mode === 'fixed'
    ? formatDuration(durationMs)
    : `${formatDuration(minMs)} – ${formatDuration(maxMs)}`;

  return (
    <div className="flex h-full items-start justify-center overflow-auto p-4">
      <div className="w-full max-w-xs space-y-4">
        {/* Human-readable preview */}
        <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-center">
          <span className="text-sm font-medium text-purple-500" data-testid="human-duration">{humanDuration}</span>
        </div>

        {/* Mode toggle */}
        <div>
          <label className="text-app-secondary mb-1.5 block text-xs font-medium">Mode</label>
          <div className="flex gap-1">
            {(['fixed', 'random'] as const).map((m) => (
              <button
                key={m}
                type="button"
                className={`flex-1 rounded-md border px-4 py-1.5 text-sm font-medium transition-colors ${
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
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
              data-testid="duration-input"
            />
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <label htmlFor={`sleep-min-${node.id}`} className="text-app-secondary mb-1.5 block text-xs font-medium">Min (ms)</label>
              <input
                id={`sleep-min-${node.id}`}
                type="number"
                min={0}
                max={MAX_DURATION}
                step={100}
                value={minMs}
                onChange={(e) => persist({ minMs: clamp(Number(e.target.value)) })}
                className={`border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm ${minMaxError ? 'ring-1 ring-red-500' : ''}`}
                data-testid="min-input"
              />
            </div>
            <div className="flex-1">
              <label htmlFor={`sleep-max-${node.id}`} className="text-app-secondary mb-1.5 block text-xs font-medium">Max (ms)</label>
              <input
                id={`sleep-max-${node.id}`}
                type="number"
                min={0}
                max={MAX_DURATION}
                step={100}
                value={maxMs}
                onChange={(e) => persist({ maxMs: clamp(Number(e.target.value)) })}
                className={`border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm ${minMaxError ? 'ring-1 ring-red-500' : ''}`}
                data-testid="max-input"
              />
            </div>
          </div>
        )}

        {minMaxError && (
          <p className="text-xs text-red-500" data-testid="validation-error">{minMaxError}</p>
        )}
      </div>
    </div>
  );
}
