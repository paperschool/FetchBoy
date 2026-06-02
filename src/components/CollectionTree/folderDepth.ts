import type { Folder } from '@/lib/db';

/**
 * Maximum folder nesting allowed, in user-facing levels (1..5).
 * Internally folder depth is 0-based, so the deepest permitted 0-based depth is
 * MAX_FOLDER_DEPTH - 1 (= 4). Shared by create, move and drag-drop guards so the
 * limit is defined exactly once.
 */
export const MAX_FOLDER_DEPTH = 5;

/** Deepest permitted 0-based depth (collection-level folders are depth 0). */
export const MAX_FOLDER_DEPTH_INDEX = MAX_FOLDER_DEPTH - 1;

export interface FolderMaps {
    byId: Map<string, Folder>;
    byParent: Map<string | null, Folder[]>;
}

export function buildFolderMaps(folders: Folder[]): FolderMaps {
    const byId = new Map(folders.map((f) => [f.id, f]));
    const byParent = new Map<string | null, Folder[]>();
    for (const f of folders) {
        const list = byParent.get(f.parent_id) ?? [];
        list.push(f);
        byParent.set(f.parent_id, list);
    }
    return { byId, byParent };
}

/** 0-based depth of a folder (walks parent_id to root). Cycle/orphan safe. */
export function folderDepth(folderId: string, byId: Map<string, Folder>): number {
    let depth = 0;
    let cur = byId.get(folderId);
    const seen = new Set<string>();
    while (cur && cur.parent_id !== null) {
        if (seen.has(cur.id)) break; // cycle guard
        seen.add(cur.id);
        const parent = byId.get(cur.parent_id);
        if (!parent) break; // orphan: missing parent → treat current as effectively rooted
        depth++;
        cur = parent;
    }
    return depth;
}

/** Number of levels of descendants below a folder (0 if it has no sub-folders). Cycle safe. */
export function subtreeHeight(
    folderId: string,
    byParent: Map<string | null, Folder[]>,
    seen: Set<string> = new Set(),
): number {
    if (seen.has(folderId)) return 0; // cycle guard
    seen.add(folderId);
    const children = byParent.get(folderId) ?? [];
    if (children.length === 0) return 0;
    return 1 + Math.max(...children.map((c) => subtreeHeight(c.id, byParent, seen)));
}

/** Can a new (empty) sub-folder be created under `parentId` without exceeding the cap? */
export function canCreateSubFolder(parentId: string, folders: Folder[]): boolean {
    const { byId } = buildFolderMaps(folders);
    return folderDepth(parentId, byId) + 1 <= MAX_FOLDER_DEPTH_INDEX;
}

/**
 * Can `draggedId` be nested directly under `targetId`?
 * Rejects self-drop, cycles (target inside dragged's subtree), and any move whose
 * dragged folder OR its deepest descendant would exceed the 5-level cap.
 */
export function canNestFolder(draggedId: string, targetId: string, folders: Folder[]): boolean {
    if (draggedId === targetId) return false;
    const { byId, byParent } = buildFolderMaps(folders);
    if (!byId.has(draggedId) || !byId.has(targetId)) return false;

    // Cycle guard: target must not be the dragged folder or one of its descendants.
    let cur: Folder | undefined = byId.get(targetId);
    const seen = new Set<string>();
    while (cur) {
        if (cur.id === draggedId) return false;
        if (cur.parent_id === null) break;
        if (seen.has(cur.id)) break;
        seen.add(cur.id);
        cur = byId.get(cur.parent_id);
    }

    const targetDepth = folderDepth(targetId, byId); // 0-based
    const height = subtreeHeight(draggedId, byParent); // levels below dragged
    // Dragged lands at targetDepth + 1; its deepest descendant at targetDepth + 1 + height.
    return targetDepth + 1 + height <= MAX_FOLDER_DEPTH_INDEX;
}
