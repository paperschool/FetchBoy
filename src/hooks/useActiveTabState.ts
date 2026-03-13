import { useTabStore } from '@/stores/tabStore';
import type { RequestSnapshot, ResponseSnapshot } from '@/stores/tabStore';

export function useActiveRequestState(): {
    state: RequestSnapshot;
    update: (patch: Partial<RequestSnapshot>) => void;
} {
    const state = useTabStore((s) => {
        const tab = s.tabs.find((t) => t.id === s.activeTabId);
        return tab!.requestState;
    });

    const update = (patch: Partial<RequestSnapshot>) => {
        const { activeTabId, updateTabRequestState } = useTabStore.getState();
        updateTabRequestState(activeTabId, patch);
    };

    return { state, update };
}

export function useActiveResponseState(): {
    state: ResponseSnapshot;
    update: (patch: Partial<ResponseSnapshot>) => void;
} {
    const state = useTabStore((s) => {
        const tab = s.tabs.find((t) => t.id === s.activeTabId);
        return tab!.responseState;
    });

    const update = (patch: Partial<ResponseSnapshot>) => {
        const { activeTabId, updateTabResponseState } = useTabStore.getState();
        updateTabResponseState(activeTabId, patch);
    };

    return { state, update };
}
