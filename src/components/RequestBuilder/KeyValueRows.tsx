import type { KeyValueRow } from '@/stores/requestStore';
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface KeyValueRowsProps {
  sectionName: 'headers' | 'query';
  rows: KeyValueRow[];
  addLabel: string;
  onAdd: () => void;
  onUpdate: (index: number, field: 'key' | 'value', value: string) => void;
  onToggleEnabled: (index: number) => void;
  onRemove: (index: number) => void;
  toolbarRightAction?: ReactNode;
  toolbarInlineMessage?: string | null;
}

export function KeyValueRows({
  sectionName,
  rows,
  addLabel,
  onAdd,
  onUpdate,
  onToggleEnabled,
  onRemove,
  toolbarRightAction,
  toolbarInlineMessage,
}: KeyValueRowsProps) {
  const rowsContainerClassName =
    sectionName === 'query'
      ? 'max-h-56 space-y-2 overflow-y-auto pr-1'
      : 'space-y-2';

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onAdd}
          className="border-app-subtle text-app-primary hover-bg-app-surface rounded-md border px-3 py-1.5 text-sm font-medium"
        >
          {addLabel}
        </button>

        {toolbarRightAction || toolbarInlineMessage ? (
          <div className="flex flex-col items-end gap-1">
            {toolbarRightAction}
            {toolbarInlineMessage ? <p className="text-xs text-orange-400">{toolbarInlineMessage}</p> : null}
          </div>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <p className="text-app-muted text-sm">No {sectionName} configured yet.</p>
      ) : null}

      <div className={rowsContainerClassName}>
        {rows.map((row, index) => (
          <div key={`${sectionName}-${index}`} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2">
            <label className="text-app-secondary inline-flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={() => onToggleEnabled(index)}
                aria-label={`${sectionName}-enabled-${index}`}
              />
              On
            </label>
            <input
              aria-label={`${sectionName}-key-${index}`}
              value={row.key}
              onChange={(event) => onUpdate(index, 'key', event.target.value)}
              placeholder="Key"
              className="border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm"
            />
            <input
              aria-label={`${sectionName}-value-${index}`}
              value={row.value}
              onChange={(event) => onUpdate(index, 'value', event.target.value)}
              placeholder="Value"
              className="border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="border-app-subtle text-app-primary hover-bg-app-surface inline-flex h-9 w-9 items-center justify-center rounded-md border"
              aria-label={`${sectionName}-remove-${index}`}
              title="Remove"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
