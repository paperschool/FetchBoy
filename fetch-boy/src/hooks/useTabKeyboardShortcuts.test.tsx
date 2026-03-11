import { render } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import useTabKeyboardShortcuts from './useTabKeyboardShortcuts';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from '@/stores/tabStore';

function TestHost() {
    useTabKeyboardShortcuts();
    return null;
}

function resetTabStoreWithTwoTabs() {
    const first = {
        id: crypto.randomUUID(),
        label: 'Tab 1',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: createDefaultResponseSnapshot(),
    };
    const second = {
        id: crypto.randomUUID(),
        label: 'Tab 2',
        isCustomLabel: false,
        requestState: createDefaultRequestSnapshot(),
        responseState: createDefaultResponseSnapshot(),
    };
    useTabStore.setState({ tabs: [first, second], activeTabId: first.id });
}

describe('useTabKeyboardShortcuts', () => {
    beforeEach(() => {
        resetTabStoreWithTwoTabs();
        vi.clearAllMocks();
    });

    it("meta+t triggers addTab()", () => {
        const spy = vi.spyOn(useTabStore.getState(), 'addTab');
        render(<TestHost />);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true }));

        expect(spy).toHaveBeenCalledTimes(1);
    });

    it("meta+w triggers closeTab() with current activeTabId", () => {
        const state = useTabStore.getState();
        const activeId = state.activeTabId;
        const spy = vi.spyOn(state, 'closeTab');
        render(<TestHost />);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', metaKey: true }));

        expect(spy).toHaveBeenCalledWith(activeId);
    });

    it("meta+Tab triggers navigateTab('next')", () => {
        const spy = vi.spyOn(useTabStore.getState(), 'navigateTab');
        render(<TestHost />);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', metaKey: true }));

        expect(spy).toHaveBeenCalledWith('next');
    });

    it('does not fire shortcut when target is an input element', () => {
        const spy = vi.spyOn(useTabStore.getState(), 'addTab');
        render(<TestHost />);

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 't', metaKey: true, bubbles: true }));

        expect(spy).not.toHaveBeenCalled();
        input.remove();
    });
});
