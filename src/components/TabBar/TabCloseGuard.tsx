import { useEffect } from 'react';
import { useTabStore } from '@/stores/tabStore';
import { saveTabRequest } from '@/lib/persistTab';
import { showErrorToast } from '@/stores/toastStore';

/**
 * Story 22.3 — the unsaved-changes prompt shown when a tab with edits to a saved
 * request is closed. Mounted once; driven by tabStore.pendingCloseTabId.
 * Save / Don't Save / Cancel.
 */
export function TabCloseGuard() {
  const pendingCloseTabId = useTabStore((s) => s.pendingCloseTabId);
  const tab = useTabStore((s) => s.tabs.find((t) => t.id === s.pendingCloseTabId));
  const closeTab = useTabStore((s) => s.closeTab);
  const cancelPendingClose = useTabStore((s) => s.cancelPendingClose);

  useEffect(() => {
    if (!pendingCloseTabId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelPendingClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingCloseTabId, cancelPendingClose]);

  if (!pendingCloseTabId || !tab) return null;

  const handleSave = async (): Promise<void> => {
    // Only close once the save actually persisted — otherwise the edits the user
    // clicked Save to keep would be lost. On failure keep the tab (and prompt) open.
    const ok = await saveTabRequest(tab.requestState).catch(() => false);
    if (ok) closeTab(tab.id);
    else showErrorToast('Could not save changes — the tab was kept open.');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      data-testid="tab-close-guard-overlay"
      onClick={cancelPendingClose}
    >
      <div
        className="bg-app-main border border-app-subtle rounded-lg p-5 w-[420px] shadow-xl"
        data-testid="tab-close-guard"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-app-primary font-semibold text-base mb-1">Unsaved changes</h2>
        <p className="text-app-secondary text-sm mb-4">
          Save changes to “{tab.label}”? Your unsaved changes will be lost.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancelPendingClose}
            data-testid="tab-close-cancel"
            className="h-9 rounded-md border border-app-subtle px-3 text-sm text-app-secondary hover:bg-app-subtle cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => closeTab(tab.id)}
            data-testid="tab-close-dont-save"
            className="h-9 rounded-md px-3 text-sm text-red-500 hover:bg-app-subtle cursor-pointer"
          >
            Don&apos;t Save
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            data-testid="tab-close-save"
            className="h-9 rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
