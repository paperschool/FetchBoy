import { describe, it, expect } from 'vitest';
import {
    MAX_FOLDER_DEPTH,
    buildFolderMaps,
    folderDepth,
    subtreeHeight,
    canCreateSubFolder,
    canNestFolder,
} from './folderDepth';
import type { Folder } from '@/lib/db';

const mk = (id: string, parent_id: string | null): Folder => ({
    id, collection_id: 'col-1', parent_id, name: id, sort_order: 0,
    created_at: 'ts', updated_at: 'ts',
});

// A straight chain 0→1→2→3→4 (depths 0..4)
const chain: Folder[] = [0, 1, 2, 3, 4].map((d) => mk(`f${d}`, d === 0 ? null : `f${d - 1}`));

describe('folderDepth helpers', () => {
    it('MAX_FOLDER_DEPTH is 5', () => {
        expect(MAX_FOLDER_DEPTH).toBe(5);
    });

    it('folderDepth walks parent_id to root', () => {
        const { byId } = buildFolderMaps(chain);
        expect(folderDepth('f0', byId)).toBe(0);
        expect(folderDepth('f4', byId)).toBe(4);
    });

    it('subtreeHeight counts descendant levels', () => {
        const { byParent } = buildFolderMaps(chain);
        expect(subtreeHeight('f4', byParent)).toBe(0); // leaf
        expect(subtreeHeight('f3', byParent)).toBe(1); // one child level
        expect(subtreeHeight('f0', byParent)).toBe(4); // four levels below
    });

    it('subtreeHeight terminates on a cyclic parent_id graph (no stack overflow)', () => {
        // a↔b cycle, e.g. from a corrupted import — must return a finite count, not hang.
        const cyclic: Folder[] = [mk('a', 'b'), mk('b', 'a')];
        const { byParent } = buildFolderMaps(cyclic);
        expect(Number.isFinite(subtreeHeight('a', byParent))).toBe(true);
    });

    describe('canCreateSubFolder', () => {
        it('blocks creating under a depth-4 parent (would be depth 5)', () => {
            expect(canCreateSubFolder('f4', chain)).toBe(false);
        });
        it('allows creating under a depth-3 parent (child depth 4)', () => {
            expect(canCreateSubFolder('f3', chain)).toBe(true);
        });
        it('allows creating under a root folder', () => {
            expect(canCreateSubFolder('f0', chain)).toBe(true);
        });
    });

    describe('canNestFolder', () => {
        it('rejects nesting anything onto a depth-4 target (already deepest)', () => {
            const leaf = [...chain, mk('drag', null)];
            expect(canNestFolder('drag', 'f4', leaf)).toBe(false);
        });

        it('accepts a leaf nested onto a depth-3 target (lands at depth 4)', () => {
            const leaf = [...chain, mk('drag', null)];
            expect(canNestFolder('drag', 'f3', leaf)).toBe(true);
        });

        it('rejects a 1-tall subtree onto a depth-3 target (deepest would be depth 5)', () => {
            const withSubtree = [...chain, mk('drag', null), mk('dragChild', 'drag')];
            expect(canNestFolder('drag', 'f3', withSubtree)).toBe(false);
        });

        it('accepts a 1-tall subtree onto a depth-2 target (deepest lands at depth 4)', () => {
            const withSubtree = [...chain, mk('drag', null), mk('dragChild', 'drag')];
            expect(canNestFolder('drag', 'f2', withSubtree)).toBe(true);
        });

        it('rejects self-drop', () => {
            expect(canNestFolder('f1', 'f1', chain)).toBe(false);
        });

        it('rejects a cycle (target is inside dragged subtree)', () => {
            // nesting f1 under its own descendant f3 would create a cycle
            expect(canNestFolder('f1', 'f3', chain)).toBe(false);
        });
    });
});
