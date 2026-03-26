import { useState, useEffect } from 'react';
import { Check, AlertCircle, Play, Pause } from 'lucide-react';
import { useMappingsStore } from '@/stores/mappingsStore';
import type { MatchType, MappingEditForm } from '@/stores/mappingsStore';
import type { MappingHeader, MappingCookie } from '@/lib/db';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { validateUrlPattern, MATCH_TYPES, PLACEHOLDERS } from './MappingEditor.utils';
import { MappingHeadersEditor } from './MappingHeadersEditor';
import { MappingCookieEditor } from './MappingCookieEditor';
import { MappingResponseBodyEditor } from './MappingResponseBodyEditor';
import { MappingUrlRemapEditor } from './MappingUrlRemapEditor';
import { useMappingLogStore } from '@/stores/mappingLogStore';
import { formatTimestamp, OVERRIDE_ICONS } from '@/components/Intercept view/MappingLogTable.utils';

interface Props {
    onClose: () => void;
}

type EditorTab = 'match' | 'response' | 'headers' | 'cookies' | 'remap' | 'log';

const TABS = [
    { id: 'match', label: 'Match' },
    { id: 'response', label: 'Response' },
    { id: 'headers', label: 'Headers' },
    { id: 'cookies', label: 'Cookies' },
    { id: 'remap', label: 'Remap' },
    { id: 'log', label: 'Log' },
];

function MappingLogTab({ mappingId }: { mappingId: string | null }) {
    const entries = useMappingLogStore((s) => s.entries);
    const filtered = mappingId ? entries.filter((e) => e.mappingId === mappingId) : [];
    if (filtered.length === 0) {
        return <p className="text-app-muted text-sm">No activity logged for this mapping yet.</p>;
    }
    return (
        <div className="space-y-1 text-xs">
            {filtered.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 py-1 border-b border-app-subtle">
                    <span className="text-app-muted tabular-nums w-[70px] shrink-0">{formatTimestamp(entry.timestamp)}</span>
                    <span className="text-app-primary flex-1 truncate">{entry.url}</span>
                    <span className="flex gap-1">
                        {entry.overridesApplied.map((o) => {
                            const icon = OVERRIDE_ICONS[o];
                            return icon ? <span key={o} className={`font-bold ${icon.color}`} title={icon.tooltip}>{icon.label}</span> : null;
                        })}
                    </span>
                </div>
            ))}
        </div>
    );
}

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
    const [cookies, setCookies] = useState<MappingCookie[]>(editForm.cookies);
    const [responseBodyEnabled, setResponseBodyEnabled] = useState(editForm.responseBodyEnabled);
    const [responseBody, setResponseBody] = useState(editForm.responseBody);
    const [responseBodyContentType, setResponseBodyContentType] = useState(editForm.responseBodyContentType);
    const [responseBodyFilePath, setResponseBodyFilePath] = useState(editForm.responseBodyFilePath);
    const [urlRemapEnabled, setUrlRemapEnabled] = useState(editForm.urlRemapEnabled);
    const [urlRemapTarget, setUrlRemapTarget] = useState(editForm.urlRemapTarget);
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
            cookies,
            responseBodyEnabled,
            responseBody,
            responseBodyContentType,
            responseBodyFilePath,
            urlRemapEnabled,
            urlRemapTarget,
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
            data-tour="mapping-editor"
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
                    {activeTab === 'cookies' && (
                        <MappingCookieEditor cookies={cookies} onChange={setCookies} />
                    )}
                    {activeTab === 'remap' && (
                        <MappingUrlRemapEditor
                            enabled={urlRemapEnabled}
                            target={urlRemapTarget}
                            onChangeEnabled={setUrlRemapEnabled}
                            onChangeTarget={setUrlRemapTarget}
                        />
                    )}
                    {activeTab === 'response' && (
                        <MappingResponseBodyEditor
                            enabled={responseBodyEnabled}
                            body={responseBody}
                            contentType={responseBodyContentType}
                            filePath={responseBodyFilePath}
                            onChangeEnabled={setResponseBodyEnabled}
                            onChangeBody={setResponseBody}
                            onChangeContentType={setResponseBodyContentType}
                            onChangeFilePath={setResponseBodyFilePath}
                        />
                    )}
                    {activeTab === 'log' && <MappingLogTab mappingId={editForm.id} />}
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
