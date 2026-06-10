import { useEffect } from 'react';
import { Ban, Plus, Pencil, Trash2, Play, Pause } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { useIgnoreRulesStore } from '@/stores/ignoreRulesStore';
import { loadAllIgnoreRules, syncIgnoreRulesToProxy } from '@/lib/ignoreRules';
import { t } from '@/lib/i18n';

export function IgnoreRulesTable() {
    const rules = useIgnoreRulesStore((s) => s.rules);
    const loadAll = useIgnoreRulesStore((s) => s.loadAll);
    const startEditing = useIgnoreRulesStore((s) => s.startEditing);
    const deleteRule = useIgnoreRulesStore((s) => s.deleteRule);
    const toggleEnabled = useIgnoreRulesStore((s) => s.toggleEnabled);
    const selectedRuleId = useIgnoreRulesStore((s) => s.selectedRuleId);

    // Load rules once and keep the running proxy in sync — mirrors MappingsTree.
    useEffect(() => {
        loadAllIgnoreRules()
            .then((rs) => loadAll(rs))
            .catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        syncIgnoreRulesToProxy(rules).catch(() => {});
    }, [rules]);

    return (
        <div data-testid="ignore-rules-table" className="h-full flex flex-col bg-app-main">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-app-subtle shrink-0">
                <span className="text-app-muted text-xs">
                    {t('intercept.ignoreCount', { count: rules.length, plural: rules.length === 1 ? '' : 's' })}
                </span>
                <button
                    type="button"
                    onClick={() => startEditing()}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs text-app-muted hover:text-app-inverse hover:bg-app-subtle cursor-pointer transition-colors"
                    data-testid="ignore-add-rule"
                >
                    <Plus size={13} /> {t('intercept.ignoreAddRule')}
                </button>
            </div>

            {rules.length === 0 ? (
                <EmptyState
                    icon={Ban}
                    label={t('intercept.ignoreEmpty')}
                    action={() => startEditing()}
                    actionLabel={t('intercept.ignoreAddRule')}
                />
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-1">
                    <p className="text-app-muted text-[11px] px-2 py-1 leading-snug">{t('intercept.ignoreDescription')}</p>
                    {rules.map((rule) => (
                        <div
                            key={rule.id}
                            data-testid={`ignore-rule-${rule.id}`}
                            onClick={() => startEditing(rule)}
                            className={`flex items-center gap-1.5 py-1 px-2 rounded group cursor-pointer ${
                                selectedRuleId === rule.id ? 'bg-app-subtle' : 'hover:bg-app-subtle'
                            }`}
                        >
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); void toggleEnabled(rule.id); }}
                                aria-label={rule.enabled ? 'Disable ignore rule' : 'Enable ignore rule'}
                                title={rule.enabled ? 'Disable' : 'Enable'}
                                className={`flex-shrink-0 p-1 rounded cursor-pointer transition-colors ${
                                    rule.enabled
                                        ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                                        : 'text-app-muted hover:text-app-secondary hover:bg-app-subtle/40'
                                }`}
                            >
                                {rule.enabled ? <Pause size={11} /> : <Play size={11} />}
                            </button>
                            <Ban size={12} className={`flex-shrink-0 ${rule.enabled ? 'text-emerald-400' : 'text-app-muted'}`} />
                            <span className="flex-1 text-app-secondary text-xs truncate">{rule.name}</span>
                            <span className="flex-shrink-0 text-app-muted text-[10px] font-mono truncate max-w-[40%]">{rule.url_pattern}</span>
                            <span className="flex-shrink-0 text-app-muted text-[9px] uppercase tracking-wide">{rule.match_type}</span>
                            <div className="hidden group-hover:flex items-center gap-0.5">
                                <button
                                    onClick={(e) => { e.stopPropagation(); startEditing(rule); }}
                                    aria-label="Edit ignore rule"
                                    title="Edit"
                                    className="p-1 rounded text-app-muted hover:text-app-inverse cursor-pointer"
                                >
                                    <Pencil size={12} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); void deleteRule(rule.id); }}
                                    aria-label="Delete ignore rule"
                                    title="Delete"
                                    className="p-1 rounded text-red-400 hover:text-red-300 cursor-pointer"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
