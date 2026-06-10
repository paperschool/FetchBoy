import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Loader2, Check, AlertCircle } from 'lucide-react';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { UrlPatternInput } from '@/components/ui/UrlPatternInput';
import { validateUrlPattern } from '@/lib/urlPatternConfig';
import { useIgnoreRulesStore } from '@/stores/ignoreRulesStore';
import type { MatchType, IgnoreRuleEditForm } from '@/stores/ignoreRulesStore';
import { t } from '@/lib/i18n';

interface Props {
    onClose: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
const DEBOUNCE_MS = 800;
const SAVED_DISPLAY_MS = 2000;

export function IgnoreRuleEditor({ onClose }: Props) {
    const editForm = useIgnoreRulesStore((s) => s.editForm);
    const silentSave = useIgnoreRulesStore((s) => s.silentSave);
    const storeEnabled = useIgnoreRulesStore((s) =>
        s.rules.find((r) => r.id === editForm.id)?.enabled
    );
    const toggleEnabled = useIgnoreRulesStore((s) => s.toggleEnabled);
    const isNew = editForm.id === null;

    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [localEnabled, setLocalEnabled] = useState(editForm.enabled);
    const enabled = storeEnabled ?? localEnabled;
    const [urlError, setUrlError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

    const ruleIdRef = useRef(editForm.id);
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

    // Current form values, read by the save routine (kept out of effect deps).
    const formRef = useRef({ name, urlPattern, matchType, enabled });
    formRef.current = { name, urlPattern, matchType, enabled };

    // Bump to trigger a debounced save; the effect below watches it.
    const [saveGen, setSaveGen] = useState(0);
    const dirty = () => setSaveGen((g) => g + 1);

    const edit = {
        name: (v: string) => { setName(v); dirty(); },
        urlPattern: (v: string) => { setUrlPattern(v); dirty(); },
        matchType: (v: MatchType) => { setMatchType(v); dirty(); },
        // Existing rule: toggleEnabled owns the field (immediate write + rollback),
        // so don't also schedule a debounced save that would race it. New rule:
        // nothing to toggle yet, so persist it via the debounced save.
        enabled: () => {
            if (editForm.id) void toggleEnabled(editForm.id);
            else { setLocalEnabled((e) => !e); dirty(); }
        },
    };

    const buildForm = (f: typeof formRef.current): IgnoreRuleEditForm => ({
        id: ruleIdRef.current,
        name: f.name.trim() || t('intercept.ignoreNewRule'),
        urlPattern: f.urlPattern.trim(),
        matchType: f.matchType,
        enabled: f.enabled,
    });

    // The actual save. Validates current form values and keeps at most one save in
    // flight — a request that arrives while a save is running re-arms instead of
    // firing, so a slow create can't be duplicated.
    function saveNow() {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const f = formRef.current;
        if (validateUrlPattern(f.urlPattern, f.matchType) || !f.urlPattern.trim()) {
            setSaveStatus('idle');
            return;
        }
        if (savingRef.current) {
            debounceRef.current = setTimeout(() => saveNowRef.current(), DEBOUNCE_MS);
            return;
        }
        savingRef.current = true;
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setSaveStatus('saving');
        silentSave(buildForm(f))
            .then((savedId) => {
                ruleIdRef.current = savedId;
                setSaveStatus('saved');
                savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISPLAY_MS);
            })
            .catch(() => setSaveStatus('error'))
            .finally(() => { savingRef.current = false; });
    }
    const saveNowRef = useRef(saveNow);
    saveNowRef.current = saveNow;

    // Debounced auto-save. Depends only on the generation counter; values are read
    // from refs at fire time.
    useEffect(() => {
        if (saveGen === 0) return; // skip mount
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => saveNowRef.current(), DEBOUNCE_MS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [saveGen]);

    // Flush a pending edit before the editor unmounts so closing within the debounce
    // window doesn't silently drop it. Skips when a save is already running to keep
    // the single-save invariant (avoids a duplicate create).
    const handleClose = () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const f = formRef.current;
        if (!validateUrlPattern(f.urlPattern, f.matchType) && f.urlPattern.trim() && !savingRef.current) {
            void silentSave(buildForm(f)).then((id) => { ruleIdRef.current = id; });
        }
        onClose();
    };

    return (
        <ViewerShell
            testId="ignore-rule-editor"
            header={<h3 className="text-app-inverse font-medium text-sm">{isNew ? t('intercept.ignoreNewRule') : t('intercept.ignoreEditRule')}</h3>}
        >
            <>
                <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                    <div>
                        <label className="block text-app-muted text-xs mb-1">{t('intercept.ignoreName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => edit.name(e.target.value)}
                            className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                            data-testid="ignore-name-input"
                        />
                    </div>
                    <UrlPatternInput
                        urlPattern={urlPattern}
                        onUrlPatternChange={edit.urlPattern}
                        matchType={matchType}
                        onMatchTypeChange={edit.matchType}
                        urlError={urlError}
                        testIdPrefix="ignore-"
                    />
                    <button
                        type="button"
                        onClick={() => edit.enabled()}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                            enabled ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-gray-500/20 text-app-muted hover:bg-gray-500/30'
                        }`}
                        title={enabled ? 'Click to disable this rule' : 'Click to enable this rule'}
                        data-testid="ignore-enabled-toggle"
                    >
                        {enabled ? <Pause size={13} /> : <Play size={13} />}
                        {enabled ? t('mappings.enabled') : t('mappings.disabled')}
                    </button>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-app-subtle">
                    <div className="flex items-center gap-1.5 text-xs h-6" data-testid="ignore-save-status">
                        {saveStatus === 'saving' && (
                            <><Loader2 size={13} className="animate-spin text-blue-400" /><span className="text-app-muted">{t('common.saving')}</span></>
                        )}
                        {saveStatus === 'saved' && (
                            <><Check size={13} className="text-emerald-400" /><span className="text-emerald-400">{t('common.saved')}</span></>
                        )}
                        {saveStatus === 'error' && (
                            <><AlertCircle size={13} className="text-red-400" /><span className="text-red-400">{t('intercept.ignoreSaveFailed')}</span></>
                        )}
                    </div>
                    <button onClick={handleClose} className="px-4 py-1.5 text-sm text-app-muted hover:text-app-inverse">
                        {t('common.close')}
                    </button>
                </div>
            </>
        </ViewerShell>
    );
}
