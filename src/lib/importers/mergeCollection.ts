import type { Collection, KeyValuePair } from '@/lib/db';
import type { ImportWarning } from './types';

// ─── Pure merge helpers (DB-free, unit-tested) ───────────────────────────────
//
// Story 21.2: re-importing a collection whose name matches an existing one merges
// into it instead of minting a duplicate. These helpers carry the decision logic;
// the two import paths (native importExport, wizard persist) do the snapshot load
// and the actual inserts/store updates around them.

/** Exact (case-sensitive) name lookup — the merge trigger. */
export function findCollectionByExactName<T extends Pick<Collection, 'name'>>(
    name: string,
    collections: T[],
): T | undefined {
    return collections.find((c) => c.name === name);
}

/** Next sort_order to append after existing items (0 when empty). */
export function nextSortOrderBase(existing: { sort_order: number }[]): number {
    return existing.length ? Math.max(...existing.map((i) => i.sort_order)) + 1 : 0;
}

/**
 * Merge incoming env variables into existing ones. New keys are added; a key
 * present in both keeps the EXISTING value (bias to existing) and — when the
 * incoming value differs — emits a conflict warning naming the kept and ignored
 * values. Identical values are a silent no-op.
 */
export function mergeEnvVariables(
    existing: KeyValuePair[],
    incoming: KeyValuePair[],
): { variables: KeyValuePair[]; warnings: ImportWarning[] } {
    const variables = [...existing];
    const warnings: ImportWarning[] = [];
    const byKey = new Map(existing.map((v) => [v.key, v]));

    for (const inc of incoming) {
        const current = byKey.get(inc.key);
        if (!current) {
            variables.push(inc);
            byKey.set(inc.key, inc);
        } else if (current.value !== inc.value) {
            warnings.push({
                field: inc.key,
                severity: 'warning',
                message: `Variable "${inc.key}" already exists — kept existing value "${current.value}", ignored imported "${inc.value}".`,
            });
        }
    }

    return { variables, warnings };
}
