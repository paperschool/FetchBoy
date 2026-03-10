import { describe, it, expect, beforeEach } from 'vitest';
import { useUiSettingsStore } from './uiSettingsStore';

describe('uiSettingsStore', () => {
    beforeEach(() => {
        useUiSettingsStore.setState({
            theme: 'system',
            editorFontSize: 13,
            requestTimeoutMs: 30000,
            sslVerify: true,
        });
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

    it('initial requestTimeoutMs is 30000', () => {
        expect(useUiSettingsStore.getState().requestTimeoutMs).toBe(30000);
    });

    it('setRequestTimeoutMs updates requestTimeoutMs', () => {
        useUiSettingsStore.getState().setRequestTimeoutMs(5000);
        expect(useUiSettingsStore.getState().requestTimeoutMs).toBe(5000);
    });

    it('initial sslVerify is true', () => {
        expect(useUiSettingsStore.getState().sslVerify).toBe(true);
    });

    it('setSslVerify(false) updates store', () => {
        useUiSettingsStore.getState().setSslVerify(false);
        expect(useUiSettingsStore.getState().sslVerify).toBe(false);
    });
});
