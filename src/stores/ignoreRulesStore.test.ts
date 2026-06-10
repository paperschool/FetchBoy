import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IgnoreRule } from '@/lib/db';

// Mock the db/proxy layer so the store can be tested in isolation.
const created: IgnoreRule[] = [];
vi.mock('@/lib/ignoreRules', () => ({
    createIgnoreRule: vi.fn(async (name: string, urlPattern: string, matchType: IgnoreRule['match_type']) => {
        const rule: IgnoreRule = {
            id: `id-${created.length + 1}`,
            name,
            url_pattern: urlPattern,
            match_type: matchType,
            enabled: true,
            created_at: 't',
            updated_at: 't',
        };
        created.push(rule);
        return rule;
    }),
    updateIgnoreRule: vi.fn(async () => {}),
    deleteIgnoreRule: vi.fn(async () => {}),
    syncIgnoreRulesToProxy: vi.fn(async () => {}),
}));

import { useIgnoreRulesStore } from '@/stores/ignoreRulesStore';
import { syncIgnoreRulesToProxy, updateIgnoreRule } from '@/lib/ignoreRules';

const makeRule = (overrides: Partial<IgnoreRule> = {}): IgnoreRule => ({
    id: crypto.randomUUID(),
    name: 'Ignore CDN',
    url_pattern: 'cdn.example.com',
    match_type: 'partial',
    enabled: true,
    created_at: 't',
    updated_at: 't',
    ...overrides,
});

const reset = () => {
    created.length = 0;
    vi.clearAllMocks();
    useIgnoreRulesStore.setState({ rules: [], selectedRuleId: null, isEditing: false });
};

describe('ignoreRulesStore', () => {
    beforeEach(reset);

    it('loadAll populates rules', () => {
        const rules = [makeRule({ id: 'a' }), makeRule({ id: 'b' })];
        useIgnoreRulesStore.getState().loadAll(rules);
        expect(useIgnoreRulesStore.getState().rules).toEqual(rules);
    });

    it('createRule appends a rule and syncs to proxy', async () => {
        await useIgnoreRulesStore.getState().createRule('Ignore API', 'api.example.com', 'partial');
        const { rules } = useIgnoreRulesStore.getState();
        expect(rules).toHaveLength(1);
        expect(rules[0].url_pattern).toBe('api.example.com');
        expect(syncIgnoreRulesToProxy).toHaveBeenCalledWith(rules);
    });

    it('toggleEnabled flips enabled and persists', async () => {
        const rule = makeRule({ id: 'x', enabled: true });
        useIgnoreRulesStore.getState().loadAll([rule]);
        await useIgnoreRulesStore.getState().toggleEnabled('x');
        expect(useIgnoreRulesStore.getState().rules[0].enabled).toBe(false);
        expect(updateIgnoreRule).toHaveBeenCalledWith('x', { enabled: false });
        expect(syncIgnoreRulesToProxy).toHaveBeenCalled();
    });

    it('deleteRule removes the rule', async () => {
        useIgnoreRulesStore.getState().loadAll([makeRule({ id: 'gone' }), makeRule({ id: 'stay' })]);
        await useIgnoreRulesStore.getState().deleteRule('gone');
        const ids = useIgnoreRulesStore.getState().rules.map((r) => r.id);
        expect(ids).toEqual(['stay']);
    });

    it('startEditing(rule) loads the edit form; cancelEditing resets it', () => {
        const rule = makeRule({ id: 'e', name: 'Edit Me', url_pattern: 'x.com', match_type: 'wildcard' });
        useIgnoreRulesStore.getState().startEditing(rule);
        let s = useIgnoreRulesStore.getState();
        expect(s.isEditing).toBe(true);
        expect(s.editForm).toMatchObject({ id: 'e', name: 'Edit Me', urlPattern: 'x.com', matchType: 'wildcard' });
        useIgnoreRulesStore.getState().cancelEditing();
        s = useIgnoreRulesStore.getState();
        expect(s.isEditing).toBe(false);
        expect(s.editForm.id).toBeNull();
    });

    it('startEditing() with no rule opens a blank new-rule form', () => {
        useIgnoreRulesStore.getState().startEditing();
        const s = useIgnoreRulesStore.getState();
        expect(s.isEditing).toBe(true);
        expect(s.editForm.id).toBeNull();
        expect(s.selectedRuleId).toBeNull();
    });
});
