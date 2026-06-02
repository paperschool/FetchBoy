import { describe, it, expect } from 'vitest';
import { applyImportOptions, type ImportOptions } from './postProcess';
import type { ImportResult } from './types';

// Build a straight chain f0→f1→…→f{n-1}, each folder holding one request.
function chainFixture(levels: number): ImportResult {
    const folders = Array.from({ length: levels }, (_, d) => ({
        id: `f${d}`,
        collection_id: 'col-1',
        parent_id: d === 0 ? null : `f${d - 1}`,
        name: `Level ${d}`,
        sort_order: 0,
    }));
    const requests = Array.from({ length: levels }, (_, d) => ({
        id: `r${d}`,
        collection_id: 'col-1',
        folder_id: `f${d}`,
        name: `Req ${d}`,
        method: 'GET',
        url: '',
        headers: [],
        query_params: [],
        body_type: 'none' as const,
        body_content: '',
        auth_type: 'none' as const,
        auth_config: {},
        pre_request_script: '',
        pre_request_script_enabled: false,
        sort_order: 0,
    }));
    return {
        collection: { id: 'col-1', name: 'C', description: '', default_environment_id: null },
        folders,
        requests,
        warnings: [],
        environments: [],
    };
}

// Depth-limiting in isolation: disable the other options that would also reshape the tree.
const depthOnly = (maxDepth: number): ImportOptions => ({
    flattenSingleChild: false,
    filterTopFolders: false,
    selectedTopFolderIds: new Set(),
    limitDepth: true,
    maxDepth,
    mergeSameName: false,
});

const depthOf = (folders: ImportResult['folders'], id: string): number => {
    const byId = new Map(folders.map((f) => [f.id, f]));
    let depth = 0;
    let cur = byId.get(id);
    while (cur && cur.parent_id !== null) {
        cur = byId.get(cur.parent_id);
        depth++;
    }
    return depth;
};

describe('applyImportOptions depth limiting (5 levels)', () => {
    it('a 6-level import keeps exactly 5 levels; the 6th folds into its depth-4 ancestor', () => {
        const out = applyImportOptions(chainFixture(6), depthOnly(5));

        // Folders f0..f4 survive (depths 0..4); f5 is dropped.
        expect(out.folders.map((f) => f.id).sort()).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
        const maxDepth = Math.max(...out.folders.map((f) => depthOf(out.folders, f.id)));
        expect(maxDepth).toBe(4); // 0-based → 5 levels

        // The request that lived in f5 is re-parented to the deepest kept ancestor (f4).
        const r5 = out.requests.find((r) => r.id === 'r5');
        expect(r5?.folder_id).toBe('f4');
        // The other requests stay put.
        expect(out.requests.find((r) => r.id === 'r0')?.folder_id).toBe('f0');
        expect(out.requests.find((r) => r.id === 'r4')?.folder_id).toBe('f4');
    });

    it('a 3-level import is unchanged under a 5-level limit', () => {
        const out = applyImportOptions(chainFixture(3), depthOnly(5));
        expect(out.folders.map((f) => f.id).sort()).toEqual(['f0', 'f1', 'f2']);
        expect(out.requests.find((r) => r.id === 'r2')?.folder_id).toBe('f2');
    });

    it('hard-clamps to 5 levels even when the depth-limit toggle is off', () => {
        // limitDepth=false must NOT bypass the 5-level cap the runtime guards enforce.
        const opts: ImportOptions = {
            flattenSingleChild: false,
            filterTopFolders: false,
            selectedTopFolderIds: new Set(),
            limitDepth: false,
            maxDepth: 10,
            mergeSameName: false,
        };
        const out = applyImportOptions(chainFixture(7), opts);
        expect(out.folders.map((f) => f.id).sort()).toEqual(['f0', 'f1', 'f2', 'f3', 'f4']);
        const maxDepth = Math.max(...out.folders.map((f) => depthOf(out.folders, f.id)));
        expect(maxDepth).toBe(4); // 0-based → 5 levels
        // Requests from the dropped deep folders fold into the deepest kept ancestor.
        expect(out.requests.find((r) => r.id === 'r6')?.folder_id).toBe('f4');
    });
});
