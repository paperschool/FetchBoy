import { useState, useEffect, useRef } from 'react';
import { Check, AlertCircle, Play, Pause, Workflow, Loader2, Eye, Trash2 } from 'lucide-react';
import { useMappingsStore } from '@/stores/mappingsStore';
import type { MatchType, MappingEditForm } from '@/stores/mappingsStore';
import { useStitchStore } from '@/stores/stitchStore';
import { useAppTabStore } from '@/stores/appTabStore';
import { DEFAULT_MAPPING_CONFIG, DEFAULT_MAPPING_ENTRY_CONFIG, DEFAULT_MAPPING_EXIT_CONFIG } from '@/types/stitch';
import type { MappingHeader, MappingCookie } from '@/lib/db';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { UrlPatternInput } from '@/components/ui/UrlPatternInput';
import { validateUrlPattern } from '@/lib/urlPatternConfig';
import { t } from '@/lib/i18n';
import { MappingHeadersEditor } from './MappingHeadersEditor';
import { MappingCookieEditor } from './MappingCookieEditor';
import { MappingResponseBodyEditor } from './MappingResponseBodyEditor';
import { MappingUrlRemapEditor } from './MappingUrlRemapEditor';
import { useMappingLogStore } from '@/stores/mappingLogStore';
import { formatTimestamp, OVERRIDE_ICONS } from '@/components/InterceptView/MappingLogTable.utils';

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

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const DEBOUNCE_MS = 800;
const SAVED_DISPLAY_MS = 2000;

export function MappingEditor({ onClose }: Props) {
    const { editForm, silentSave } = useMappingsStore();
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
    const [useChain, setUseChain] = useState(editForm.useChain ?? false);
    const [chainId, setChainId] = useState<string | null>(editForm.chainId ?? null);
    const [urlError, setUrlError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const mappingIdRef = useRef(editForm.id);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const savingRef = useRef(false);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        };
    }, []);

    useEffect(() => {
        setUrlError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    // Called by the debounce timer — not a hook dep, just a stable ref.
    const formRef = useRef({ name, urlPattern, matchType, enabled, headersAdd, headersRemove, cookies, responseBodyEnabled, responseBody, responseBodyContentType, responseBodyFilePath, urlRemapEnabled, urlRemapTarget, useChain, chainId });
    formRef.current = { name, urlPattern, matchType, enabled, headersAdd, headersRemove, cookies, responseBodyEnabled, responseBody, responseBodyContentType, responseBodyFilePath, urlRemapEnabled, urlRemapTarget, useChain, chainId };

    // Bump this to trigger a debounced save. The effect below watches it.
    const [saveGen, setSaveGen] = useState(0);
    const dirty = () => setSaveGen((g) => g + 1);

    // Wrapped setters that also mark the form dirty for auto-save.
    const edit = {
        name:        (v: string) => { setName(v); dirty(); },
        urlPattern:  (v: string) => { setUrlPattern(v); dirty(); },
        matchType:   (v: MatchType) => { setMatchType(v); dirty(); },
        headersAdd:  (v: MappingHeader[]) => { setHeadersAdd(v); dirty(); },
        headersRemove: (v: MappingHeader[]) => { setHeadersRemove(v); dirty(); },
        cookies:     (v: MappingCookie[]) => { setCookies(v); dirty(); },
        responseBodyEnabled: (v: boolean) => { setResponseBodyEnabled(v); dirty(); },
        responseBody: (v: string) => { setResponseBody(v); dirty(); },
        responseBodyContentType: (v: string) => { setResponseBodyContentType(v); dirty(); },
        responseBodyFilePath: (v: string) => { setResponseBodyFilePath(v); dirty(); },
        urlRemapEnabled: (v: boolean) => { setUrlRemapEnabled(v); dirty(); },
        urlRemapTarget: (v: string) => { setUrlRemapTarget(v); dirty(); },
        useChain:    (v: boolean) => { setUseChain(v); dirty(); },
        chainId:     (v: string | null) => { setChainId(v); dirty(); },
        enabled:     () => { if (editForm.id) void toggleEnabled(editForm.id); else setLocalEnabled((e) => !e); dirty(); },
    };

    // Debounced auto-save. Reads form values from refs so the effect only
    // depends on the generation counter — no store values in deps at all.
    useEffect(() => {
        if (saveGen === 0) return;              // skip mount
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveStatus('saving');
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            const f = formRef.current;
            const err = validateUrlPattern(f.urlPattern, f.matchType);
            if (err || !f.urlPattern) { setSaveStatus('idle'); return; }

            savingRef.current = true;
            const form: MappingEditForm = { ...editForm, id: mappingIdRef.current, ...f };
            silentSave(form)
                .then((savedId) => {
                    mappingIdRef.current = savedId;
                    setSaveStatus('saved');
                    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISPLAY_MS);
                })
                .catch(() => setSaveStatus('error'))
                .finally(() => { savingRef.current = false; });
        }, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveGen]);

    return (
        <ViewerShell tabs={TABS} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as EditorTab)}
            header={<h3 className="text-app-inverse font-medium text-sm">{isNew ? t('mappings.new') : t('mappings.edit')}</h3>}
            testId="mapping-editor"
            data-tour="mapping-editor"
        >
            <>
                <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                    {activeTab === 'match' && (
                        <>
                            <div>
                                <label className="block text-app-muted text-xs mb-1">{t('mappings.name')}</label>
                                <input
                                    type="text" value={name}
                                    onChange={(e) => edit.name(e.target.value)}
                                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                                    data-testid="mapping-name-input"
                                />
                            </div>
                            <UrlPatternInput
                                urlPattern={urlPattern}
                                onUrlPatternChange={edit.urlPattern}
                                matchType={matchType}
                                onMatchTypeChange={edit.matchType}
                                urlError={urlError}
                                testIdPrefix="mapping-"
                            />
                            <div className="flex items-center gap-2">
                            <button type="button"
                                onClick={() => edit.enabled()}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                    enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-gray-500/20 text-app-muted hover:bg-gray-500/30'
                                }`}
                                title={enabled ? 'Click to disable this mapping' : 'Click to enable this mapping'}
                            >
                                {enabled ? <Pause size={13} /> : <Play size={13} />}
                                {enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            {useChain && chainId ? (
                                <>
                                    <button type="button"
                                        onClick={async () => {
                                            const stitchStore = useStitchStore.getState();
                                            await stitchStore.loadChain(chainId);
                                            // Upgrade old single-connection entry→exit to 4 keyed connections
                                            const freshState = useStitchStore.getState();
                                            const entryNode = freshState.nodes.find((n: { type: string }) => n.type === 'mapping-entry');
                                            const exitNode = freshState.nodes.find((n: { type: string }) => n.type === 'mapping-exit');
                                            if (entryNode && exitNode) {
                                                const entryToExit = freshState.connections.filter(
                                                    (c: { sourceNodeId: string; targetNodeId: string }) => c.sourceNodeId === entryNode.id && c.targetNodeId === exitNode.id,
                                                );
                                                const hasOldSingle = entryToExit.length === 1 && entryToExit[0].sourceKey === null;
                                                if (hasOldSingle) {
                                                    await stitchStore.removeConnection(entryToExit[0].id);
                                                    for (const key of ['status', 'headers', 'body', 'cookies']) {
                                                        await stitchStore.addConnection({
                                                            chainId, sourceNodeId: entryNode.id, sourceKey: key,
                                                            targetNodeId: exitNode.id, targetSlot: key,
                                                        });
                                                    }
                                                }
                                            }
                                            useAppTabStore.getState().setActiveTab('stitch');
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                        title="View linked Stitch chain"
                                        data-testid="view-chain-button"
                                    >
                                        <Eye size={13} />
                                        View Chain
                                    </button>
                                    <button type="button"
                                        onClick={async () => {
                                            const stitchStore = useStitchStore.getState();
                                            await stitchStore.deleteChain(chainId);
                                            edit.useChain(false);
                                            edit.chainId(null);
                                        }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                        title="Delete linked chain and unhook from this mapping"
                                        data-testid="remove-chain-button"
                                    >
                                        <Trash2 size={13} />
                                        Remove Chain
                                    </button>
                                </>
                            ) : (
                                <button type="button"
                                    onClick={async () => {
                                        const stitchStore = useStitchStore.getState();
                                        // Delete stale chain reference if one exists
                                        if (chainId) {
                                            await stitchStore.deleteChain(chainId).catch(() => {});
                                        }
                                        // Create a new bound chain with entry/exit nodes
                                        const chain = await stitchStore.createChain(`Mapping: ${name}`, editForm.id);
                                        await stitchStore.loadChain(chain.id);
                                        // Mapping node is engine-only (hidden) — entry/exit are its children
                                        const mappingContainer = await stitchStore.addNode({
                                            chainId: chain.id, type: 'mapping', positionX: -9999, positionY: -9999,
                                            config: { ...DEFAULT_MAPPING_CONFIG, urlPattern, matchType }, label: name, parentNodeId: null,
                                        });
                                        const entry = await stitchStore.addNode({
                                            chainId: chain.id, type: 'mapping-entry', positionX: 200, positionY: 80,
                                            config: { ...DEFAULT_MAPPING_ENTRY_CONFIG }, label: 'Entry', parentNodeId: mappingContainer.id,
                                        });
                                        const exit = await stitchStore.addNode({
                                            chainId: chain.id, type: 'mapping-exit', positionX: 200, positionY: 350,
                                            config: { ...DEFAULT_MAPPING_EXIT_CONFIG }, label: 'Exit', parentNodeId: mappingContainer.id,
                                        });
                                        for (const key of ['status', 'headers', 'body', 'cookies']) {
                                            await stitchStore.addConnection({
                                                chainId: chain.id, sourceNodeId: entry.id, sourceKey: key, targetNodeId: exit.id, targetSlot: key,
                                            });
                                        }
                                        edit.chainId(chain.id);
                                        edit.useChain(true);
                                        useAppTabStore.getState().setActiveTab('stitch');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors bg-gray-500/20 text-app-muted hover:bg-gray-500/30"
                                    title="Create a Stitch chain for this mapping"
                                    data-testid="use-chain-toggle"
                                >
                                    <Workflow size={13} />
                                    Use Chain
                                </button>
                            )}
                            </div>
                        </>
                    )}
                    {activeTab === 'headers' && (
                        <MappingHeadersEditor
                            headersAdd={headersAdd}
                            headersRemove={headersRemove}
                            onChangeAdd={edit.headersAdd}
                            onChangeRemove={edit.headersRemove}
                        />
                    )}
                    {activeTab === 'cookies' && (
                        <MappingCookieEditor cookies={cookies} onChange={edit.cookies} />
                    )}
                    {activeTab === 'remap' && (
                        <MappingUrlRemapEditor
                            enabled={urlRemapEnabled}
                            target={urlRemapTarget}
                            onChangeEnabled={edit.urlRemapEnabled}
                            onChangeTarget={edit.urlRemapTarget}
                        />
                    )}
                    {activeTab === 'response' && (
                        <MappingResponseBodyEditor
                            enabled={responseBodyEnabled}
                            body={responseBody}
                            contentType={responseBodyContentType}
                            filePath={responseBodyFilePath}
                            onChangeEnabled={edit.responseBodyEnabled}
                            onChangeBody={edit.responseBody}
                            onChangeContentType={edit.responseBodyContentType}
                            onChangeFilePath={edit.responseBodyFilePath}
                        />
                    )}
                    {activeTab === 'log' && <MappingLogTab mappingId={editForm.id} />}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-app-subtle">
                    <div className="flex items-center gap-1.5 text-xs h-6" data-testid="mapping-save-status">
                        {saveStatus === 'saving' && (
                            <><Loader2 size={13} className="animate-spin text-blue-400" /><span className="text-app-muted">{t('common.saving')}</span></>
                        )}
                        {saveStatus === 'saved' && (
                            <><Check size={13} className="text-emerald-400" /><span className="text-emerald-400">{t('common.saved')}</span></>
                        )}
                        {saveStatus === 'error' && (
                            <><AlertCircle size={13} className="text-red-400" /><span className="text-red-400">{t('mappings.saveFailed')}</span></>
                        )}
                    </div>
                    <button onClick={onClose} className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse">
                        {t('common.close')}
                    </button>
                </div>
            </>
        </ViewerShell>
    );
}
