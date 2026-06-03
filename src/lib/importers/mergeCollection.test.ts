import { describe, it, expect } from 'vitest';
import type { KeyValuePair } from '@/lib/db';
import { findCollectionByExactName, nextSortOrderBase, mergeEnvVariables } from './mergeCollection';

const kv = (key: string, value: string): KeyValuePair => ({ key, value, enabled: true });

describe('findCollectionByExactName', () => {
    const cols = [{ name: 'Alpha' }, { name: 'Beta' }];

    it('finds an exact name match', () => {
        expect(findCollectionByExactName('Beta', cols)).toEqual({ name: 'Beta' });
    });

    it('returns undefined for a new name (create path)', () => {
        expect(findCollectionByExactName('Gamma', cols)).toBeUndefined();
    });

    it('is case-sensitive (no fuzzy match)', () => {
        expect(findCollectionByExactName('beta', cols)).toBeUndefined();
    });
});

describe('nextSortOrderBase', () => {
    it('is 0 when there are no existing items', () => {
        expect(nextSortOrderBase([])).toBe(0);
    });

    it('continues after the max existing sort_order', () => {
        expect(nextSortOrderBase([{ sort_order: 0 }, { sort_order: 4 }, { sort_order: 2 }])).toBe(5);
    });
});

describe('mergeEnvVariables', () => {
    it('unions: adds new keys, keeps existing ones', () => {
        const { variables, warnings } = mergeEnvVariables(
            [kv('A', '1')],
            [kv('B', '2')],
        );
        expect(variables.map((v) => v.key).sort()).toEqual(['A', 'B']);
        expect(warnings).toHaveLength(0);
    });

    it('keeps the existing value on a conflict and warns', () => {
        const { variables, warnings } = mergeEnvVariables(
            [kv('TOKEN', 'existing')],
            [kv('TOKEN', 'incoming')],
        );
        expect(variables).toHaveLength(1);
        expect(variables[0].value).toBe('existing');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].field).toBe('TOKEN');
        expect(warnings[0].severity).toBe('warning');
        expect(warnings[0].message).toContain('existing');
        expect(warnings[0].message).toContain('incoming');
    });

    it('does not warn when an incoming key matches an identical existing value', () => {
        const { variables, warnings } = mergeEnvVariables(
            [kv('A', 'same')],
            [kv('A', 'same')],
        );
        expect(variables).toHaveLength(1);
        expect(warnings).toHaveLength(0);
    });

    it('mixes additions and conflicts in one pass', () => {
        const { variables, warnings } = mergeEnvVariables(
            [kv('A', '1'), kv('B', '2')],
            [kv('B', '99'), kv('C', '3')],
        );
        expect(variables.find((v) => v.key === 'B')!.value).toBe('2');
        expect(variables.find((v) => v.key === 'C')!.value).toBe('3');
        expect(warnings).toHaveLength(1);
        expect(warnings[0].field).toBe('B');
    });
});
