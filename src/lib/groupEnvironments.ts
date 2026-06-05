import type { Collection, Environment } from '@/lib/db';

/** A collection's environments (or the shared/null-owner group). */
export interface EnvironmentGroup {
    /** Owning collection id, or null for the shared group. */
    collectionId: string | null;
    /** Display label — the owning collection's live name, or "Shared". */
    label: string;
    environments: Environment[];
}

export const SHARED_GROUP_LABEL = 'Shared';

/**
 * Group environments under their owning collection (Story 21.1's
 * `owner_collection_id`). Environments with no owner — or whose owning
 * collection no longer exists (orphan) — fall into a single "Shared" group so
 * they never crash or disappear. Owned groups come first in the collections'
 * given order, then Shared last; empty collections are omitted.
 *
 * Pure / DB-free — derived from the two lists only.
 */
export function groupEnvironmentsByCollection(
    environments: Environment[],
    collections: Pick<Collection, 'id' | 'name'>[],
): EnvironmentGroup[] {
    const collById = new Map(collections.map((c) => [c.id, c]));
    const owned = new Map<string, Environment[]>();
    const shared: Environment[] = [];

    for (const env of environments) {
        const ownerId = env.owner_collection_id ?? null;
        if (ownerId && collById.has(ownerId)) {
            const list = owned.get(ownerId);
            if (list) list.push(env);
            else owned.set(ownerId, [env]);
        } else {
            // null owner OR orphan (owning collection deleted) → Shared.
            shared.push(env);
        }
    }

    const groups: EnvironmentGroup[] = [];
    for (const c of collections) {
        const envs = owned.get(c.id);
        if (envs && envs.length > 0) {
            groups.push({ collectionId: c.id, label: c.name, environments: envs });
        }
    }
    if (shared.length > 0) {
        groups.push({ collectionId: null, label: SHARED_GROUP_LABEL, environments: shared });
    }
    return groups;
}
