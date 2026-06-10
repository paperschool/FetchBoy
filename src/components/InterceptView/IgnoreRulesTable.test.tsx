import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { IgnoreRule } from '@/lib/db';

vi.mock('@/lib/ignoreRules', () => ({
    loadAllIgnoreRules: vi.fn(async () => []),
    syncIgnoreRulesToProxy: vi.fn(async () => {}),
}));

import { IgnoreRulesTable } from './IgnoreRulesTable';
import { useIgnoreRulesStore } from '@/stores/ignoreRulesStore';

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

describe('IgnoreRulesTable', () => {
    beforeEach(() => {
        useIgnoreRulesStore.setState({ rules: [], selectedRuleId: null, isEditing: false });
    });

    it('shows the empty state with no rules', () => {
        render(<IgnoreRulesTable />);
        expect(screen.getByText('No ignore rules yet')).toBeInTheDocument();
    });

    it('renders rules and the count', () => {
        useIgnoreRulesStore.setState({ rules: [makeRule({ id: 'a', name: 'Rule A' }), makeRule({ id: 'b', name: 'Rule B' })] });
        render(<IgnoreRulesTable />);
        expect(screen.getByText('2 ignore rules')).toBeInTheDocument();
        expect(screen.getByText('Rule A')).toBeInTheDocument();
        expect(screen.getByTestId('ignore-rule-b')).toBeInTheDocument();
    });

    it('Add Rule opens the editor (startEditing)', () => {
        render(<IgnoreRulesTable />);
        fireEvent.click(screen.getByTestId('ignore-add-rule'));
        expect(useIgnoreRulesStore.getState().isEditing).toBe(true);
        expect(useIgnoreRulesStore.getState().editForm.id).toBeNull();
    });

    it('clicking a rule opens it for editing', () => {
        useIgnoreRulesStore.setState({ rules: [makeRule({ id: 'a', name: 'Rule A' })] });
        render(<IgnoreRulesTable />);
        fireEvent.click(screen.getByTestId('ignore-rule-a'));
        expect(useIgnoreRulesStore.getState().isEditing).toBe(true);
        expect(useIgnoreRulesStore.getState().editForm.id).toBe('a');
    });
});
