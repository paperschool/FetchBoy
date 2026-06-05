import type { RequestSnapshot } from '@/stores/tabStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { updateSavedRequest } from '@/lib/collections';
import { buildSavedChangesFromSnapshot } from '@/lib/requestSnapshotUtils';

/**
 * Persist a tab's edits back to its saved request (Story 22.3). Works for any
 * tab snapshot, not just the active one, so the close-tab guard can save a tab
 * that isn't focused. No-op (returns false) for an unsaved/new tab.
 */
export async function saveTabRequest(snapshot: RequestSnapshot): Promise<boolean> {
  const id = snapshot.savedRequestId;
  if (!id) return false;
  const store = useCollectionStore.getState();
  const existing = store.requests.find((r) => r.id === id);
  if (!existing) return false;
  const changes = buildSavedChangesFromSnapshot(snapshot);
  await updateSavedRequest(id, { ...existing, ...changes });
  store.updateRequest(id, changes);
  return true;
}
