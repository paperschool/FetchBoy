import { describe, it, expect, beforeEach } from 'vitest';
import { useUiSettingsStore } from './uiSettingsStore';

describe('uiSettingsStore', () => {
    beforeEach(() => {
        useUiSettingsStore.setState({ theme: 'system', editorFontSize: 13 });
    });

    it('has initial theme value of "system"', () => {
        expect(useUiSettingsStore.getState().theme).toBe('system');
    });

    it('setTheme updates theme in store', () => {
        useUiSettingsStore.getState().setTheme('dark');
        expect(useUiSettingsStore.getState().theme).toBe('dark');
    });

    it('setTheme updates theme to light', () => {
        useUiSettingsStore.getState().setTheme('light');
        expect(useUiSettingsStore.getState().theme).toBe('light');
    });

    it('setEditorFontSize updates editorFontSize', () => {
        useUiSettingsStore.getState().setEditorFontSize(16);
        expect(useUiSettingsStore.getState().editorFontSize).toBe(16);
    });
});
