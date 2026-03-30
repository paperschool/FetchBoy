import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Check, AlertCircle, Play, Pause } from 'lucide-react';
import { useBreakpointsStore, validateUrlPattern } from '@/stores/breakpointsStore';
import type { MatchType, EditForm } from '@/stores/breakpointsStore';
import { useInterceptStore } from '@/stores/interceptStore';
import { ViewerShell } from '@/components/ui/ViewerShell';

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

const MATCH_DESCRIPTIONS: Record<MatchType, string> = {
    exact: 'The full URL must match the pattern character-for-character, including protocol and query string.',
    partial: 'The pattern can appear anywhere in the URL as a substring.',
    wildcard: 'Use * as a wildcard to match any characters. e.g. *api.example.com/v2/* matches any path under /v2/.',
    regex: 'A regular expression evaluated against the full URL. e.g. /users/\\d+ matches numeric user IDs.',
};

export function BreakpointEditor({ onClose }: Props) {
    const { editForm, saveBreakpoint } = useBreakpointsStore();
    const storeEnabled = useBreakpointsStore((s) =>
        s.breakpoints.find((b) => b.id === editForm.id)?.enabled
    );
    const toggleBreakpointEnabled = useBreakpointsStore((s) => s.toggleBreakpointEnabled);
    const isNew = editForm.id === null;

    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [localEnabled, setLocalEnabled] = useState(editForm.enabled);
    const enabled = storeEnabled ?? localEnabled;
    const [urlError, setUrlError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const interceptRequests = useInterceptStore((s) => s.requests);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setUrlError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    const computeMatchCount = useCallback(async () => {
        if (!urlPattern.trim()) {
            setMatchCount(null);
            return;
        }
        let count = 0;
        for (const req of interceptRequests) {
            const fullUrl = `https://${req.host}${req.path}`;
            try {
                const result = await invoke<{ matches: boolean }>('match_breakpoint_url', {
                    url: fullUrl, pattern: urlPattern, matchType,
                });
                if (result.matches) count++;
            } catch {
                // pattern invalid — skip
            }
        }
        setMatchCount(count);
    }, [urlPattern, matchType, interceptRequests]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { void computeMatchCount(); }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [computeMatchCount]);

    const canSave = !urlError && !!urlPattern && !saving;

    const handleSave = async () => {
        const validationError = validateUrlPattern(urlPattern, matchType);
        if (validationError) { setUrlError(validationError); return; }
        setSaving(true);
        const form: EditForm = {
            ...editForm,
            name,
            urlPattern,
            matchType,
            enabled,
        };
        try {
            await saveBreakpoint(form);
            onClose();
        } finally {
            setSaving(false);
        }
    };

    return (
        <ViewerShell
            header={<h3 className="text-app-inverse font-medium text-sm">{isNew ? 'New Breakpoint' : 'Edit Breakpoint'}</h3>}
            testId="breakpoint-editor"
        >
            <>
                <div className="flex-1 overflow-y-auto space-y-3 pb-3">
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
                        {matchCount !== null && !urlError && urlPattern.trim() && (
                            <p className="text-app-muted text-xs mt-1">
                                History matches: <span className={matchCount > 0 ? 'text-green-400' : 'text-app-muted'}>{matchCount}</span>
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
                        <p className="text-app-muted text-[11px] mt-1.5 leading-snug">{MATCH_DESCRIPTIONS[matchType]}</p>
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
