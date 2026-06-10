import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { IgnoreRule } from '@/lib/db';
import {
    createIgnoreRule as dbCreateIgnoreRule,
    updateIgnoreRule as dbUpdateIgnoreRule,
    deleteIgnoreRule as dbDeleteIgnoreRule,
    syncIgnoreRulesToProxy,
} from '@/lib/ignoreRules';
import { saveEntity, ignoreRuleFormToDb } from '@/stores/helpers/crudStoreHelpers';

export type MatchType = 'exact' | 'partial' | 'wildcard' | 'regex';

export interface IgnoreRuleEditForm {
    id: string | null;
    name: string;
    urlPattern: string;
    matchType: MatchType;
    enabled: boolean;
}

const defaultEditForm: IgnoreRuleEditForm = {
    id: null, name: 'New Ignore Rule', urlPattern: '', matchType: 'partial', enabled: true,
};

function entityToForm(r: IgnoreRule): IgnoreRuleEditForm {
    return {
        id: r.id, name: r.name, urlPattern: r.url_pattern,
        matchType: r.match_type, enabled: r.enabled,
    };
}

interface IgnoreRulesState {
    rules: IgnoreRule[];
    selectedRuleId: string | null;
    isEditing: boolean;
    editForm: IgnoreRuleEditForm;

    loadAll: (rules: IgnoreRule[]) => void;
    createRule: (name: string, urlPattern: string, matchType: MatchType) => Promise<void>;
    updateRule: (id: string, changes: Partial<IgnoreRule>) => Promise<void>;
    deleteRule: (id: string) => Promise<void>;
    toggleEnabled: (id: string) => Promise<void>;
    selectRule: (id: string | null) => void;
    startEditing: (rule?: IgnoreRule) => void;
    cancelEditing: () => void;
    saveRule: (form: IgnoreRuleEditForm) => Promise<void>;
}

export const useIgnoreRulesStore = create<IgnoreRulesState>()(
    immer((set, get) => ({
        rules: [],
        selectedRuleId: null,
        isEditing: false,
        editForm: { ...defaultEditForm },

        loadAll: (rules) =>
            set((state) => { state.rules = rules; }),

        createRule: async (name, urlPattern, matchType) => {
            const rule = await dbCreateIgnoreRule(name, urlPattern, matchType);
            set((state) => { state.rules.push(rule); });
            await syncIgnoreRulesToProxy(get().rules);
        },

        updateRule: async (id, changes) => {
            await dbUpdateIgnoreRule(id, changes);
            set((state) => { const r = state.rules.find((x) => x.id === id); if (r) Object.assign(r, changes); });
            await syncIgnoreRulesToProxy(get().rules);
        },

        deleteRule: async (id) => {
            await dbDeleteIgnoreRule(id);
            set((state) => { state.rules = state.rules.filter((r) => r.id !== id); });
            await syncIgnoreRulesToProxy(get().rules);
        },

        toggleEnabled: async (id) => {
            const r = get().rules.find((x) => x.id === id);
            if (!r) return;
            const newEnabled = !r.enabled;
            set((state) => { const found = state.rules.find((x) => x.id === id); if (found) found.enabled = newEnabled; });
            try {
                await dbUpdateIgnoreRule(id, { enabled: newEnabled });
                await syncIgnoreRulesToProxy(get().rules);
            } catch {
                set((state) => { const found = state.rules.find((x) => x.id === id); if (found) found.enabled = !newEnabled; });
            }
        },

        selectRule: (id) =>
            set((state) => { state.selectedRuleId = id; }),

        startEditing: (rule?) =>
            set((state) => {
                state.isEditing = true;
                if (rule) {
                    state.selectedRuleId = rule.id;
                    state.editForm = entityToForm(rule);
                } else {
                    state.selectedRuleId = null;
                    state.editForm = { ...defaultEditForm };
                }
            }),

        cancelEditing: () =>
            set((state) => { state.isEditing = false; state.editForm = { ...defaultEditForm }; }),

        saveRule: async (form: IgnoreRuleEditForm) => {
            await saveEntity({
                form,
                dbCreate: (f) => dbCreateIgnoreRule(f.name, f.urlPattern, f.matchType),
                dbUpdate: dbUpdateIgnoreRule,
                formToDbChanges: ignoreRuleFormToDb,
                applyToState: (entity, isNew) => {
                    set((state) => {
                        if (isNew) {
                            state.rules.push(entity as unknown as IgnoreRule);
                        } else {
                            const r = state.rules.find((x) => x.id === form.id);
                            if (r) Object.assign(r, ignoreRuleFormToDb(form));
                        }
                        state.isEditing = false;
                        state.editForm = { ...defaultEditForm };
                    });
                },
            });
            await syncIgnoreRulesToProxy(get().rules);
        },
    })),
);
