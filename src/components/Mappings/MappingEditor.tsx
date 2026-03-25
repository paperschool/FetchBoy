import { useState, useEffect } from 'react';
import { Check, AlertCircle, Play, Pause } from 'lucide-react';
import { useMappingsStore } from '@/stores/mappingsStore';
import type { MatchType, MappingEditForm } from '@/stores/mappingsStore';
import type { MappingHeader } from '@/lib/db';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { validateUrlPattern, MATCH_TYPES, PLACEHOLDERS } from './MappingEditor.utils';
import { MappingHeadersEditor } from './MappingHeadersEditor';

interface Props {
    onClose: () => void;
}

type EditorTab = 'match' | 'response' | 'headers' | 'cookies';

const TABS = [
    { id: 'match', label: 'Match' },
    { id: 'response', label: 'Response' },
    { id: 'headers', label: 'Headers' },
    { id: 'cookies', label: 'Cookies' },
];

export function MappingEditor({ onClose }: Props) {
    const { editForm, saveMapping } = useMappingsStore();
    const storeEnabled = useMappingsStore((s) =>
        s.mappings.find((m) => m.id === editForm.id)?.enabled
    );
    const toggleEnabled = useMappingsStore((s) => s.toggleEnabled);
    const isNew = editForm.id === null;

    const [activeTab, setActiveTab] = useState<EditorTab>('match');
    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [localEnabled, setLocalEnabled] = useState(editForm.enabled);
    const enabled = storeEnabled ?? localEnabled;
    const [headersAdd, setHeadersAdd] = useState<MappingHeader[]>(editForm.headersAdd);
    const [headersRemove, setHeadersRemove] = useState<MappingHeader[]>(editForm.headersRemove);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setUrlError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    const canSave = !urlError && !!urlPattern && !saving;

    const handleSave = async () => {
        const err = validateUrlPattern(urlPattern, matchType);
        if (err) { setUrlError(err); setActiveTab('match'); return; }
        setSaving(true);
        const form: MappingEditForm = {
            ...editForm,
            name,
            urlPattern,
            matchType,
            enabled,
            headersAdd,
            headersRemove,
        };
        try {
            await saveMapping(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <ViewerShell tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as EditorTab)}
            header={<h3 className="text-app-inverse font-medium text-sm">{isNew ? 'New Mapping' : 'Edit Mapping'}</h3>}
            testId="mapping-editor"
        >
            <>
                <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                    {activeTab === 'match' && (
                        <>
                            <div>
                                <label className="block text-app-muted text-xs mb-1">Name</label>
                                <input
                                    type="text" value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                                    data-testid="mapping-name-input"
                                />
                            </div>
                            <div>
                                <label className="block text-app-muted text-xs mb-1">URL Pattern</label>
                                <input
                                    type="text" value={urlPattern}
                                    onChange={(e) => setUrlPattern(e.target.value)}
                                    placeholder={PLACEHOLDERS[matchType]}
                                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
                                    data-testid="mapping-url-input"
                                />
                                {urlError && (
                                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="mapping-url-error">
                                        <AlertCircle size={12} /> {urlError}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-app-muted text-xs mb-1">Match Type</label>
                                <div className="flex gap-1 flex-wrap">
                                    {MATCH_TYPES.map((type) => (
                                        <button key={type}
                                            onClick={() => {
                                                if (type === 'wildcard' && urlPattern && !urlPattern.startsWith('*') && !/^https?:\/\//.test(urlPattern)) {
                                                    setUrlPattern('*' + urlPattern);
                                                }
                                                setMatchType(type);
                                            }}
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
                            <button type="button"
                                onClick={() => { if (editForm.id) void toggleEnabled(editForm.id); else setLocalEnabled((e) => !e); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                    enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-gray-500/20 text-app-muted hover:bg-gray-500/30'
                                }`}
                                title={enabled ? 'Click to disable this mapping' : 'Click to enable this mapping'}
                            >
                                {enabled ? <Pause size={13} /> : <Play size={13} />}
                                {enabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </>
                    )}
                    {activeTab === 'headers' && (
                        <MappingHeadersEditor
                            headersAdd={headersAdd}
                            headersRemove={headersRemove}
                            onChangeAdd={setHeadersAdd}
                            onChangeRemove={setHeadersRemove}
                        />
                    )}
                    {activeTab !== 'match' && activeTab !== 'headers' && (
                        <p className="text-app-muted text-sm">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} configuration — coming in a later story.</p>
                    )}
                </div>
                <div className="flex gap-2 justify-end pt-3 border-t border-app-subtle">
                    <button onClick={onClose} className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse">Cancel</button>
                    <button onClick={() => void handleSave()} disabled={!canSave}
                        className="px-4 py-1.5 text-sm bg-app-accent text-white rounded hover:bg-app-accent/80 disabled:opacity-50 flex items-center gap-1"
                        data-testid="mapping-save-button"
                    >
                        <Check size={14} /> {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </>
        </ViewerShell>
    );
}
