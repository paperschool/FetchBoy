import type { KeyValueRow } from '@/stores/requestStore';

interface KeyValueRowsProps {
  sectionName: 'headers' | 'query';
  rows: KeyValueRow[];
  addLabel: string;
  onAdd: () => void;
  onUpdate: (index: number, field: 'key' | 'value', value: string) => void;
  onToggleEnabled: (index: number) => void;
  onRemove: (index: number) => void;
}

export function KeyValueRows({
  sectionName,
  rows,
  addLabel,
  onAdd,
  onUpdate,
  onToggleEnabled,
  onRemove,
}: KeyValueRowsProps) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onAdd}
        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
      >
        {addLabel}
      </button>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No {sectionName} configured yet.</p>
      ) : null}

      {rows.map((row, index) => (
        <div key={`${sectionName}-${index}`} className="grid grid-cols-[auto_1fr_1fr_auto] gap-2">
          <label className="inline-flex items-center gap-1 text-sm text-gray-700">
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
            className="h-9 rounded-md border border-gray-300 px-2 text-sm"
          />
          <input
            aria-label={`${sectionName}-value-${index}`}
            value={row.value}
            onChange={(event) => onUpdate(index, 'value', event.target.value)}
            placeholder="Value"
            className="h-9 rounded-md border border-gray-300 px-2 text-sm"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="rounded-md border border-gray-300 px-2 text-sm hover:bg-gray-50"
            aria-label={`${sectionName}-remove-${index}`}
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
