import type { Folder } from '@/lib/db';

/**
 * Folder names from root → leaf for a leaf folder id, walking parent_id up the
 * tree. Cycle-guarded (a corrupt parent loop can't hang). Shared by the request
 * breadcrumbs in MainPanel and ScriptWorkspace so the walk lives in one place.
 */
export function buildFolderNamePath(folders: Folder[], leafFolderId: string | null): string[] {
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const path: string[] = [];
  const seen = new Set<string>();
  let fid: string | null = leafFolderId;
  while (fid && !seen.has(fid)) {
    seen.add(fid);
    const f = folderById.get(fid);
    if (!f) break;
    path.unshift(f.name);
    fid = f.parent_id;
  }
  return path;
}
