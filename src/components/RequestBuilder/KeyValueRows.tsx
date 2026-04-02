import type { KeyValueRow } from '@/stores/requestStore';
import type { ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { KeyValuePair } from '@/lib/db';
import { unresolvedTokens } from '@/lib/interpolate';
import { t } from '@/lib/i18n';

function getVariableRingClass(value: string, activeVariables?: KeyValuePair[]): string {
  if (!activeVariables || !value.includes('{{')) return '';
  return unresolvedTokens(value, activeVariables).length > 0
    ? 'ring-1 ring-red-500/50'
    : 'ring-1 ring-green-500/50';
}

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
  activeVariables?: KeyValuePair[];
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
  activeVariables,
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
        <p className="text-app-muted text-sm">{t('collections.noConfigured', { section: sectionName })}</p>
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
              {t('common.on')}
            </label>
            <input
              aria-label={`${sectionName}-key-${index}`}
              value={row.key}
              onChange={(event) => onUpdate(index, 'key', event.target.value)}
              placeholder={t('common.key')}
              className="border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm"
            />
            <input
              aria-label={`${sectionName}-value-${index}`}
              value={row.value}
              onChange={(event) => onUpdate(index, 'value', event.target.value)}
              placeholder={t('common.value')}
              className={`border-app-subtle bg-app-main text-app-primary h-9 rounded-md border px-2 text-sm ${getVariableRingClass(row.value, activeVariables)}`}
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="border-app-subtle text-app-primary hover-bg-app-surface inline-flex h-9 w-9 items-center justify-center rounded-md border"
              aria-label={`${sectionName}-remove-${index}`}
              title={t('common.remove')}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
