import { useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { ViewerShell } from '@/components/ui/ViewerShell';
import { UrlPatternInput } from '@/components/ui/UrlPatternInput';
import { validateUrlPattern } from '@/lib/urlPatternConfig';
import { useIgnoreRulesStore } from '@/stores/ignoreRulesStore';
import type { MatchType } from '@/stores/ignoreRulesStore';
import { t } from '@/lib/i18n';

interface Props {
    onClose: () => void;
}

export function IgnoreRuleEditor({ onClose }: Props) {
    const editForm = useIgnoreRulesStore((s) => s.editForm);
    const saveRule = useIgnoreRulesStore((s) => s.saveRule);
    const isNew = editForm.id === null;

    const [name, setName] = useState(editForm.name);
    const [urlPattern, setUrlPattern] = useState(editForm.urlPattern);
    const [matchType, setMatchType] = useState<MatchType>(editForm.matchType);
    const [enabled, setEnabled] = useState(editForm.enabled);

    const urlError = validateUrlPattern(urlPattern, matchType);
    const canSave = !urlError && urlPattern.trim().length > 0;

    async function handleSave() {
        if (!canSave) return;
        await saveRule({ id: editForm.id, name: name.trim() || t('intercept.ignoreNewRule'), urlPattern, matchType, enabled });
        onClose();
    }

    return (
        <ViewerShell
            testId="ignore-rule-editor"
            header={<h3 className="text-app-inverse font-medium text-sm">{isNew ? t('intercept.ignoreNewRule') : t('intercept.ignoreEditRule')}</h3>}
        >
            <div className="flex-1 overflow-y-auto space-y-3 pb-3">
                <div>
                    <label className="block text-app-muted text-xs mb-1">{t('intercept.ignoreName')}</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                        data-testid="ignore-name-input"
                    />
                </div>
                <UrlPatternInput
                    urlPattern={urlPattern}
                    onUrlPatternChange={setUrlPattern}
                    matchType={matchType}
                    onMatchTypeChange={setMatchType}
                    urlError={urlError}
                    testIdPrefix="ignore-"
                />
                <button
                    type="button"
                    onClick={() => setEnabled((e) => !e)}
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
            <div className="flex items-center justify-end gap-2 border-t border-app-subtle pt-2 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded text-xs text-app-muted hover:text-app-inverse hover:bg-app-subtle cursor-pointer transition-colors"
                    data-testid="ignore-cancel"
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-app-accent text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity"
                    data-testid="ignore-save"
                >
                    {t('common.save')}
                </button>
            </div>
        </ViewerShell>
    );
}
