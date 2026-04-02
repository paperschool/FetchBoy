import { useState, useEffect } from 'react';
import { Check, Play, Pause } from 'lucide-react';
import { useBreakpointMatching } from '@/hooks/useBreakpointMatching';
import { useBreakpointsStore } from '@/stores/breakpointsStore';
import type { EditForm } from '@/stores/breakpointsStore';
import { useInterceptStore } from '@/stores/interceptStore';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { UrlPatternInput } from '@/components/ui/UrlPatternInput';
import { validateUrlPattern } from '@/lib/urlPatternConfig';
import type { MatchType } from '@/lib/urlPatternConfig';

interface Props {
    onClose: () => void;
}

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
    const interceptRequests = useInterceptStore((s) => s.requests);
    const { computeMatchCount, matchCount } = useBreakpointMatching();

    useEffect(() => {
        setUrlError(validateUrlPattern(urlPattern, matchType));
    }, [urlPattern, matchType]);

    useEffect(() => {
        const urls = interceptRequests.map((req) => `https://${req.host}${req.path}`);
        computeMatchCount(urls, urlPattern, matchType);
    }, [urlPattern, matchType, interceptRequests, computeMatchCount]);

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

                    <UrlPatternInput
                        urlPattern={urlPattern}
                        onUrlPatternChange={setUrlPattern}
                        matchType={matchType}
                        onMatchTypeChange={setMatchType}
                        matchCount={matchCount}
                        urlError={urlError}
                        testIdPrefix="bp-"
                    />

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
