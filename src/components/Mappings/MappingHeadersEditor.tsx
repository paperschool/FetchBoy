import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';
import type { MappingHeader } from '@/lib/db';

interface Props {
    headersAdd: MappingHeader[];
    headersRemove: MappingHeader[];
    onChangeAdd: (headers: MappingHeader[]) => void;
    onChangeRemove: (headers: MappingHeader[]) => void;
}

export function MappingHeadersEditor({ headersAdd, headersRemove, onChangeAdd, onChangeRemove }: Props) {
    const [addOpen, setAddOpen] = useState(true);
    const [removeOpen, setRemoveOpen] = useState(true);

    const addRow = () => onChangeAdd([...headersAdd, { key: '', value: '', enabled: true }]);
    const updateAdd = (i: number, field: keyof MappingHeader, val: string | boolean) =>
        onChangeAdd(headersAdd.map((h, idx) => (idx === i ? { ...h, [field]: val } : h)));
    const removeAdd = (i: number) => onChangeAdd(headersAdd.filter((_, idx) => idx !== i));

    const addRemoveRow = () => onChangeRemove([...headersRemove, { key: '', value: '', enabled: true }]);
    const updateRemove = (i: number, val: string) =>
        onChangeRemove(headersRemove.map((h, idx) => (idx === i ? { ...h, key: val } : h)));
    const removeRemoveRow = (i: number) => onChangeRemove(headersRemove.filter((_, idx) => idx !== i));

    const hasEmptyAddKey = headersAdd.some((h) => h.enabled && !h.key.trim());
    const hasEmptyRemoveName = headersRemove.some((h) => !h.key.trim());
    const hasDuplicateRemove = new Set(headersRemove.map((h) => h.key.toLowerCase().trim())).size < headersRemove.filter((h) => h.key.trim()).length;

    return (
        <div className="space-y-4" data-testid="mapping-headers-editor">
            {/* Add Headers */}
            <div>
                <button type="button" onClick={() => setAddOpen(!addOpen)}
                    className="flex items-center gap-1 text-app-inverse text-sm font-medium w-full"
                    data-testid="add-headers-toggle"
                >
                    {addOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Add Headers ({headersAdd.filter((h) => h.enabled).length})
                </button>
                {addOpen && (
                    <div className="mt-2 space-y-2">
                        {headersAdd.map((header, i) => (
                            <div key={i} className="flex items-center gap-2" data-testid={`add-header-row-${i}`}>
                                <input type="checkbox" checked={header.enabled}
                                    onChange={(e) => updateAdd(i, 'enabled', e.target.checked)}
                                    aria-label={`Enable add header ${i}`} data-testid={`add-header-enabled-${i}`} />
                                <input type="text" value={header.key}
                                    onChange={(e) => updateAdd(i, 'key', e.target.value)}
                                    placeholder="Header-Name"
                                    className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
                                    data-testid={`add-header-key-${i}`} />
                                <input type="text" value={header.value}
                                    onChange={(e) => updateAdd(i, 'value', e.target.value)}
                                    placeholder="Value"
                                    className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
                                    data-testid={`add-header-value-${i}`} />
                                <button type="button" onClick={() => removeAdd(i)}
                                    className="text-red-400 hover:text-red-300 shrink-0"
                                    data-testid={`add-header-remove-${i}`}>×</button>
                            </div>
                        ))}
                        <button type="button" onClick={addRow}
                            className="text-xs text-app-accent hover:underline" data-testid="add-header-btn">
                            + Add Header
                        </button>
                        {hasEmptyAddKey && (
                            <p className="text-red-400 text-xs flex items-center gap-1" data-testid="add-headers-error">
                                <AlertCircle size={12} /> Enabled headers must have a name
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Remove Headers */}
            <div className="border-t border-app-subtle pt-4">
                <button type="button" onClick={() => setRemoveOpen(!removeOpen)}
                    className="flex items-center gap-1 text-app-inverse text-sm font-medium w-full"
                    data-testid="remove-headers-toggle"
                >
                    {removeOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    Remove Headers ({headersRemove.length})
                </button>
                {removeOpen && (
                    <div className="mt-2 space-y-2">
                        {headersRemove.map((header, i) => (
                            <div key={i} className="flex items-center gap-2" data-testid={`remove-header-row-${i}`}>
                                <input type="text" value={header.key}
                                    onChange={(e) => updateRemove(i, e.target.value)}
                                    placeholder="Header-Name-To-Remove"
                                    className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
                                    data-testid={`remove-header-name-${i}`} />
                                <button type="button" onClick={() => removeRemoveRow(i)}
                                    className="text-red-400 hover:text-red-300 shrink-0"
                                    data-testid={`remove-header-remove-${i}`}>×</button>
                            </div>
                        ))}
                        <button type="button" onClick={addRemoveRow}
                            className="text-xs text-app-accent hover:underline" data-testid="add-remove-header-btn">
                            + Add Header Name
                        </button>
                        {hasEmptyRemoveName && (
                            <p className="text-red-400 text-xs flex items-center gap-1" data-testid="remove-headers-empty-error">
                                <AlertCircle size={12} /> Header names cannot be empty
                            </p>
                        )}
                        {hasDuplicateRemove && (
                            <p className="text-red-400 text-xs flex items-center gap-1" data-testid="remove-headers-dup-error">
                                <AlertCircle size={12} /> Duplicate header names
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
