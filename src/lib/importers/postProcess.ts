import type { ImportResult } from './types';

export interface ImportOptions {
  flattenSingleChild: boolean;
  filterTopFolders: boolean;
  selectedTopFolderIds: Set<string>;
  limitDepth: boolean;
  maxDepth: number;
  mergeSameName: boolean;
}

type ImportFolder = ImportResult['folders'][number];
type ImportRequest = ImportResult['requests'][number];

/** Return the top-level (root) folders from a parsed result, sorted by sort_order. */
export function getTopLevelFolders(result: ImportResult): Array<{ id: string; name: string }> {
  return result.folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => ({ id: f.id, name: f.name }));
}

/**
 * Apply user-selected import options to a parsed ImportResult.
 *
 * Processing order:
 *  1. Filter out unselected top-level folder branches
 *  2. Collapse single-child folder chains  (A → B → … becomes "A / B / …")
 *  3. Flatten folders beyond the max-depth limit
 *  4. Merge folders that share the same name across the tree
 *  5. Prune empty folders (always runs)
 */
export function applyImportOptions(result: ImportResult, options: ImportOptions): ImportResult {
  let folders: ImportFolder[] = result.folders.map((f) => ({ ...f }));
  let requests: ImportRequest[] = result.requests.map((r) => ({ ...r }));

  // ── 1. Filter by selected top-level folders ───────────────────────────────
  if (options.filterTopFolders) {
    const keepIds = new Set<string>();

    const addDescendants = (id: string): void => {
      keepIds.add(id);
      for (const f of folders) {
        if (f.parent_id === id) addDescendants(f.id);
      }
    };

    for (const f of folders) {
      if (f.parent_id === null && options.selectedTopFolderIds.has(f.id)) {
        addDescendants(f.id);
      }
    }

    folders = folders.filter((f) => keepIds.has(f.id));
    requests = requests.filter((r) => !r.folder_id || keepIds.has(r.folder_id));
  }

  // ── 2. Collapse single-child folder chains ────────────────────────────────
  if (options.flattenSingleChild) {
    let changed = true;
    while (changed) {
      changed = false;

      const childFolderIds = new Map<string, string[]>();
      for (const f of folders) {
        const pid = f.parent_id ?? '__root__';
        if (!childFolderIds.has(pid)) childFolderIds.set(pid, []);
        childFolderIds.get(pid)!.push(f.id);
      }

      const directReqCount = new Map<string, number>();
      for (const r of requests) {
        const fid = r.folder_id ?? '__root__';
        directReqCount.set(fid, (directReqCount.get(fid) ?? 0) + 1);
      }

      for (let i = 0; i < folders.length; i++) {
        const folder = folders[i];
        const children = childFolderIds.get(folder.id) ?? [];
        const reqs = directReqCount.get(folder.id) ?? 0;

        if (children.length === 1 && reqs === 0) {
          const childId = children[0];
          const childIdx = folders.findIndex((f) => f.id === childId);
          const child = folders[childIdx];

          // Merge child into parent
          folder.name = `${folder.name} / ${child.name}`;

          // Re-parent grandchildren
          for (const f of folders) {
            if (f.parent_id === childId) f.parent_id = folder.id;
          }
          // Re-parent child's requests
          for (const r of requests) {
            if (r.folder_id === childId) r.folder_id = folder.id;
          }

          folders.splice(childIdx, 1);
          changed = true;
          break; // restart scan after mutation
        }
      }
    }
  }

  // ── 3. Limit folder depth ─────────────────────────────────────────────────
  if (options.limitDepth && options.maxDepth > 0) {
    const maxDepth = options.maxDepth; // e.g. 2 keeps depths 0 and 1

    const folderById = new Map(folders.map((f) => [f.id, f]));
    const depthOf = new Map<string, number>();

    const computeDepth = (id: string): number => {
      if (depthOf.has(id)) return depthOf.get(id)!;
      const folder = folderById.get(id);
      if (!folder?.parent_id) {
        depthOf.set(id, 0);
        return 0;
      }
      const d = computeDepth(folder.parent_id) + 1;
      depthOf.set(id, d);
      return d;
    };

    for (const f of folders) computeDepth(f.id);

    // Walk up from a deep folder to find the closest ancestor that will be kept
    const closestKeptAncestor = (folderId: string): string | null => {
      const folder = folderById.get(folderId);
      if (!folder) return null;
      if ((depthOf.get(folderId) ?? 0) < maxDepth) return folderId;
      if (!folder.parent_id) return null;
      return closestKeptAncestor(folder.parent_id);
    };

    // Move requests from deep folders up to the nearest kept ancestor
    for (const r of requests) {
      if (r.folder_id) {
        const depth = depthOf.get(r.folder_id);
        if (depth !== undefined && depth >= maxDepth) {
          r.folder_id = closestKeptAncestor(r.folder_id);
        }
      }
    }

    folders = folders.filter((f) => (depthOf.get(f.id) ?? 0) < maxDepth);
  }

  // ── 4. Merge folders with the same structural position ──────────────────────
  //
  // Computes a "relative path" for each folder: the chain of folder names from
  // the level just below the top-level (depth 0) folder down to the folder
  // itself.  This means "Action Shots > USAT" under MLB and NASCAR share the
  // key "Action Shots\0USAT" and merge, while "Player Headshots > USAT" has a
  // different key and stays separate.  Top-level folders never merge.
  // Merged folders are renamed to their full relative path so they are
  // self-describing.  Sports that lose all children are pruned in step 5.
  if (options.mergeSameName) {
    let changed = true;
    while (changed) {
      changed = false;

      // Rebuild depth map each iteration (array mutates)
      const byId = new Map(folders.map((f) => [f.id, f]));
      const depths = new Map<string, number>();
      const getDepth = (id: string): number => {
        if (depths.has(id)) return depths.get(id)!;
        const f = byId.get(id);
        if (!f?.parent_id) { depths.set(id, 0); return 0; }
        const d = getDepth(f.parent_id) + 1;
        depths.set(id, d);
        return d;
      };
      for (const f of folders) getDepth(f.id);

      // Build merge key: relative path excluding depth-0 ancestor
      const keyCache = new Map<string, string>();
      const mergeKey = (id: string): string => {
        if (keyCache.has(id)) return keyCache.get(id)!;
        const f = byId.get(id)!;
        const depth = depths.get(id) ?? 0;

        if (depth === 0) {
          // Top-level folders get a unique key — never merge
          const k = '\x00' + id;
          keyCache.set(id, k);
          return k;
        }

        const parentDepth = f.parent_id ? (depths.get(f.parent_id) ?? 0) : -1;
        // Depth 1 (direct child of a sport folder): key is just the name
        // Deeper: parent's key + name
        const k = parentDepth === 0
          ? f.name
          : (f.parent_id ? mergeKey(f.parent_id) + '\0' : '') + f.name;
        keyCache.set(id, k);
        return k;
      };

      const groups = new Map<string, string[]>();
      for (const f of folders) {
        const key = mergeKey(f.id);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(f.id);
      }

      for (const [key, ids] of groups.entries()) {
        if (ids.length < 2) continue;

        const keepId = ids[0];
        const removeIds = new Set(ids.slice(1));

        // Rename the kept folder to its full relative path so its name
        // is self-describing even without parent context.
        const kept = byId.get(keepId)!;
        const fullName = key.replace(/\0/g, ' / ');
        if (fullName !== kept.name) kept.name = fullName;

        for (const f of folders) {
          if (f.parent_id && removeIds.has(f.parent_id)) {
            f.parent_id = keepId;
          }
        }
        for (const r of requests) {
          if (r.folder_id && removeIds.has(r.folder_id)) {
            r.folder_id = keepId;
          }
        }

        folders = folders.filter((f) => !removeIds.has(f.id));
        changed = true;
        break;
      }
    }
  }

  // ── 5. Prune empty folders ────────────────────────────────────────────────
  //
  // Any earlier step can leave behind folders with no child folders and no
  // direct requests.  Remove them bottom-up until the tree is stable.
  {
    let pruned = true;
    while (pruned) {
      pruned = false;
      const hasChildren = new Set<string>();
      for (const f of folders) {
        if (f.parent_id) hasChildren.add(f.parent_id);
      }
      const hasRequests = new Set<string | null>();
      for (const r of requests) {
        hasRequests.add(r.folder_id);
      }
      const before = folders.length;
      folders = folders.filter((f) => hasChildren.has(f.id) || hasRequests.has(f.id));
      if (folders.length < before) pruned = true;
    }
  }

  return { ...result, folders, requests };
}
