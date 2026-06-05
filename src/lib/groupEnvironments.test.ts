import { describe, it, expect } from 'vitest';
import { groupEnvironmentsByCollection, SHARED_GROUP_LABEL } from './groupEnvironments';
import type { Collection, Environment } from '@/lib/db';

function env(id: string, name: string, owner: string | null = null): Environment {
    return { id, name, variables: [], is_active: false, created_at: id, owner_collection_id: owner };
}

function col(id: string, name: string): Pick<Collection, 'id' | 'name'> {
    return { id, name };
}

describe('groupEnvironmentsByCollection', () => {
    it('returns no groups for empty input', () => {
        expect(groupEnvironmentsByCollection([], [])).toEqual([]);
    });

    it('groups an owned environment under its collection', () => {
        const groups = groupEnvironmentsByCollection([env('e1', 'API Variables', 'c1')], [col('c1', 'API')]);
        expect(groups).toEqual([
            { collectionId: 'c1', label: 'API', environments: [env('e1', 'API Variables', 'c1')] },
        ]);
    });

    it('puts null-owner environments in the Shared group', () => {
        const groups = groupEnvironmentsByCollection([env('e1', 'Globals')], [col('c1', 'API')]);
        expect(groups).toEqual([
            { collectionId: null, label: SHARED_GROUP_LABEL, environments: [env('e1', 'Globals')] },
        ]);
    });

    it('treats an orphaned owner (collection deleted) as Shared', () => {
        const groups = groupEnvironmentsByCollection([env('e1', 'Stale', 'gone')], [col('c1', 'API')]);
        expect(groups).toHaveLength(1);
        expect(groups[0].collectionId).toBeNull();
        expect(groups[0].label).toBe(SHARED_GROUP_LABEL);
        expect(groups[0].environments.map((e) => e.id)).toEqual(['e1']);
    });

    it('orders owned groups by collection order with Shared last, and omits empty collections', () => {
        const environments = [
            env('e1', 'B Vars', 'cB'),
            env('e2', 'Loose'),
            env('e3', 'A Vars', 'cA'),
        ];
        const collections = [col('cA', 'Alpha'), col('cEmpty', 'Empty'), col('cB', 'Bravo')];
        const groups = groupEnvironmentsByCollection(environments, collections);
        expect(groups.map((g) => g.label)).toEqual(['Alpha', 'Bravo', SHARED_GROUP_LABEL]);
        expect(groups[0].environments.map((e) => e.id)).toEqual(['e3']);
        expect(groups[1].environments.map((e) => e.id)).toEqual(['e1']);
        expect(groups[2].environments.map((e) => e.id)).toEqual(['e2']);
    });

    it('uses the live collection name as the group label', () => {
        const groups = groupEnvironmentsByCollection([env('e1', 'x', 'c1')], [col('c1', 'Renamed')]);
        expect(groups[0].label).toBe('Renamed');
    });
});
