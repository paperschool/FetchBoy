import { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { useBreakpointsStore, validateUrlPattern } from '@/stores/breakpointsStore';
import type { MatchType, EditForm } from '@/stores/breakpointsStore';

interface Props {
    onClose: () => void;
}

const MATCH_TYPES: MatchType[] = ['exact', 'partial', 'wildcard', 'regex'];

const PLACEHOLDERS: Record<MatchType, string> = {
    exact: 'https://api.example.com/users/123',
    partial: 'api/users',
    wildcard: '*/api/users/*',
    regex: '^/api/users/\\d+$',
};

export function BreakpointEditor({ onClose }: Props) {
    const { editForm, saveBreakpoint } = useBreakpointsStore();

    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [enabled, setEnabled] = useState(editForm.enabled);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    const handleSave = async () => {
        const validationError = validateUrlPattern(urlPattern, matchType);
        if (validationError) { setError(validationError); return; }
        setSaving(true);
        const form: EditForm = {
            id: editForm.id,
            name,
            urlPattern,
            matchType,
            enabled,
            folderId: editForm.folderId,
        };
        try {
            await saveBreakpoint(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const isNew = editForm.id === null;

    return (
        <div className="p-4 bg-app-sidebar border-t border-app-subtle h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-app-inverse font-medium text-sm">
                    {isNew ? 'New Breakpoint' : 'Edit Breakpoint'}
                </h3>
                <button onClick={onClose} className="text-app-muted hover:text-app-inverse" aria-label="Close editor">
                    <X size={18} />
                </button>
            </div>

            <div className="mb-3">
                <label className="block text-app-muted text-xs mb-1">Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                    data-testid="bp-name-input"
                />
            </div>

            <div className="mb-3">
                <label className="block text-app-muted text-xs mb-1">URL Pattern</label>
                <input
                    type="text"
                    value={urlPattern}
                    onChange={(e) => setUrlPattern(e.target.value)}
                    placeholder={PLACEHOLDERS[matchType]}
                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
                    data-testid="bp-url-input"
                />
                {error && (
                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="bp-url-error">
                        <AlertCircle size={12} /> {error}
                    </p>
                )}
            </div>

            <div className="mb-3">
                <label className="block text-app-muted text-xs mb-1">Match Type</label>
                <div className="flex gap-1 flex-wrap">
                    {MATCH_TYPES.map((type) => (
                        <button
                            key={type}
                            onClick={() => setMatchType(type)}
                            className={`px-3 py-1 text-xs rounded ${
                                matchType === type
                                    ? 'bg-app-accent text-white'
                                    : 'bg-app-subtle text-app-muted hover:text-app-inverse'
                            }`}
                            data-testid={`match-type-${type}`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-4 flex items-center gap-2">
                <input
                    type="checkbox"
                    id="bp-enabled"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded"
                />
                <label htmlFor="bp-enabled" className="text-app-inverse text-sm">Enabled</label>
            </div>

            <div className="flex gap-2 justify-end">
                <button
                    onClick={onClose}
                    className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse"
                >
                    Cancel
                </button>
                <button
                    onClick={() => void handleSave()}
                    disabled={!!error || !urlPattern || saving}
                    className="px-4 py-1.5 text-sm bg-app-accent text-white rounded hover:bg-app-accent/80 disabled:opacity-50 flex items-center gap-1"
                    data-testid="bp-save-button"
                >
                    <Check size={14} />
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    );
}
