import { useState, useEffect } from 'react';
import { Check, AlertCircle, Play, Pause } from 'lucide-react';
import { useBreakpointsStore, validateUrlPattern } from '@/stores/breakpointsStore';
import type { MatchType, EditForm } from '@/stores/breakpointsStore';
import type { BreakpointHeader } from '@/lib/db';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { ResponseMappingEditor } from './ResponseMappingEditor';
import { StatusCodeEditor } from './StatusCodeEditor';
import { HeadersEditor } from './HeadersEditor';
import { RequestBlockerEditor } from './RequestBlockerEditor';

interface Props {
    onClose: () => void;
}

type EditorTab = 'match' | 'response';

const TABS = [
    { id: 'match', label: 'Match' },
    { id: 'response', label: 'Response' },
];

const MATCH_TYPES: MatchType[] = ['exact', 'partial', 'wildcard', 'regex'];

const PLACEHOLDERS: Record<MatchType, string> = {
    exact: 'https://api.example.com/users/123',
    partial: 'api/users',
    wildcard: '*/api/users/*',
    regex: '^/api/users/\\d+$',
};

export function BreakpointEditor({ onClose }: Props) {
    const { editForm, saveBreakpoint } = useBreakpointsStore();
    const storeEnabled = useBreakpointsStore((s) =>
        s.breakpoints.find((b) => b.id === editForm.id)?.enabled
    );
    const toggleBreakpointEnabled = useBreakpointsStore((s) => s.toggleBreakpointEnabled);
    const isNew = editForm.id === null;

    const [activeTab, setActiveTab] = useState<EditorTab>('match');
    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [localEnabled, setLocalEnabled] = useState(editForm.enabled);
    // For existing breakpoints, always reflect the live store value (sidebar may have toggled it)
    const enabled = storeEnabled ?? localEnabled;
    const [responseMapping, setResponseMapping] = useState({
        enabled: editForm.responseMappingEnabled,
        body: editForm.responseMappingBody,
        contentType: editForm.responseMappingContentType,
    });
    const [statusCodeEnabled, setStatusCodeEnabled] = useState(editForm.statusCodeEnabled);
    const [statusCodeValue, setStatusCodeValue] = useState(editForm.statusCodeValue);
    const [customHeaders, setCustomHeaders] = useState<BreakpointHeader[]>(editForm.customHeaders);
    const [blockRequest, setBlockRequest] = useState({
        enabled: editForm.blockRequestEnabled,
        statusCode: editForm.blockRequestStatusCode,
        body: editForm.blockRequestBody,
    });
    const [urlError, setUrlError] = useState<string | null>(null);
    const [rmJsonError, setRmJsonError] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setUrlError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    // Track whether the response mapping JSON is invalid
    useEffect(() => {
        if (responseMapping.enabled && responseMapping.contentType === 'application/json' && responseMapping.body.trim()) {
            try { JSON.parse(responseMapping.body); setRmJsonError(false); }
            catch { setRmJsonError(true); }
        } else {
            setRmJsonError(false);
        }
    }, [responseMapping]);

    const hasEmptyHeaderKey = customHeaders.some((h) => h.enabled && h.key.trim() === '');
    const canSave = !urlError && !!urlPattern && !rmJsonError && !hasEmptyHeaderKey && !saving;

    const handleSave = async () => {
        const validationError = validateUrlPattern(urlPattern, matchType);
        if (validationError) { setUrlError(validationError); setActiveTab('match'); return; }
        if (rmJsonError || hasEmptyHeaderKey) { setActiveTab('response'); return; }
        setSaving(true);
        const form: EditForm = {
            id: editForm.id,
            name,
            urlPattern,
            matchType,
            enabled,
            folderId: editForm.folderId,
            responseMappingEnabled: responseMapping.enabled,
            responseMappingBody: responseMapping.body,
            responseMappingContentType: responseMapping.contentType,
            statusCodeEnabled,
            statusCodeValue,
            customHeaders,
            blockRequestEnabled: blockRequest.enabled,
            blockRequestStatusCode: blockRequest.statusCode,
            blockRequestBody: blockRequest.body,
        };
        try {
            await saveBreakpoint(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    const activeBadgeCount =
        (responseMapping.enabled ? 1 : 0) +
        (statusCodeEnabled ? 1 : 0) +
        (customHeaders.some((h) => h.enabled) ? 1 : 0) +
        (blockRequest.enabled ? 1 : 0);

    const header = (
        <div className="flex items-center justify-between">
            <h3 className="text-app-inverse font-medium text-sm">
                {isNew ? 'New Breakpoint' : 'Edit Breakpoint'}
            </h3>
            {activeBadgeCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
                    {activeBadgeCount} override{activeBadgeCount > 1 ? 's' : ''}
                </span>
            )}
        </div>
    );

    return (
        <ViewerShell
            tabs={TABS}
            activeTab={activeTab}
            onTabChange={(id) => setActiveTab(id as EditorTab)}
            header={header}
            testId="breakpoint-editor"
        >
            <>
                <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                    {activeTab === 'match' && (
                        <>
                            <div>
                                <label className="block text-app-muted text-xs mb-1">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                                    data-testid="bp-name-input"
                                />
                            </div>

                            <div>
                                <label className="block text-app-muted text-xs mb-1">URL Pattern</label>
                                <input
                                    type="text"
                                    value={urlPattern}
                                    onChange={(e) => setUrlPattern(e.target.value)}
                                    placeholder={PLACEHOLDERS[matchType]}
                                    className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
                                    data-testid="bp-url-input"
                                />
                                {urlError && (
                                    <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="bp-url-error">
                                        <AlertCircle size={12} /> {urlError}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-app-muted text-xs mb-1">Match Type</label>
                                <div className="flex gap-1 flex-wrap">
                                    {MATCH_TYPES.map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                if (type === 'wildcard') {
                                                    const hasProtocol = /^https?:\/\//.test(urlPattern);
                                                    if (!hasProtocol && urlPattern && !urlPattern.startsWith('*')) {
                                                        setUrlPattern('*' + urlPattern);
                                                    }
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

                            <button
                                type="button"
                                onClick={() => {
                                    if (editForm.id) void toggleBreakpointEnabled(editForm.id);
                                    else setLocalEnabled((e) => !e);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                                    enabled
                                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                                        : 'bg-gray-500/20 text-app-muted hover:bg-gray-500/30'
                                }`}
                                title={enabled ? 'Click to disable this breakpoint' : 'Click to enable this breakpoint'}
                            >
                                {enabled ? <Pause size={13} /> : <Play size={13} />}
                                {enabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </>
                    )}

                    {activeTab === 'response' && (
                        <>
                            <ResponseMappingEditor
                                mapping={responseMapping}
                                onChange={setResponseMapping}
                            />
                            <StatusCodeEditor
                                enabled={statusCodeEnabled}
                                value={statusCodeValue}
                                onChange={(en, val) => { setStatusCodeEnabled(en); setStatusCodeValue(val); }}
                            />
                            <HeadersEditor
                                headers={customHeaders}
                                onChange={setCustomHeaders}
                            />
                            <RequestBlockerEditor
                                blockRequest={blockRequest}
                                onChange={setBlockRequest}
                            />
                        </>
                    )}
                </div>

                <div className="flex gap-2 justify-end pt-3 border-t border-app-subtle">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => void handleSave()}
                        disabled={!canSave}
                        className="px-4 py-1.5 text-sm bg-app-accent text-white rounded hover:bg-app-accent/80 disabled:opacity-50 flex items-center gap-1"
                        data-testid="bp-save-button"
                    >
                        <Check size={14} />
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </>
        </ViewerShell>
    );
}
