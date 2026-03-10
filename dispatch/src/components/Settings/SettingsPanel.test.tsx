import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsPanel } from './SettingsPanel';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockUiState, mockSaveSetting } = vi.hoisted(() => {
    const mockUiState = {
        theme: 'system' as 'light' | 'dark' | 'system',
        setTheme: vi.fn(),
        requestTimeoutMs: 30000,
        setRequestTimeoutMs: vi.fn(),
        sslVerify: true,
        setSslVerify: vi.fn(),
        editorFontSize: 14,
        setEditorFontSize: vi.fn(),
    };
    return { mockUiState, mockSaveSetting: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('@/stores/uiSettingsStore', () => ({
    useUiSettingsStore: (selector?: (s: typeof mockUiState) => unknown) =>
        selector ? selector(mockUiState) : mockUiState,
}));

vi.mock('@/lib/settings', () => ({
    saveSetting: (...args: unknown[]) => mockSaveSetting(...args),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsPanel', () => {
    const onClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockUiState.theme = 'system';
        mockUiState.requestTimeoutMs = 30000;
        mockUiState.sslVerify = true;
        mockUiState.editorFontSize = 14;
    });

    // ─── Render tests ──────────────────────────────────────────────────────────

    it('renders settings panel when open=true', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    });

    it('does not render when open=false', () => {
        render(<SettingsPanel open={false} onClose={onClose} />);
        expect(screen.queryByTestId('settings-panel')).not.toBeInTheDocument();
    });

    it('shows the currently active theme radio as checked (system)', () => {
        mockUiState.theme = 'system';
        render(<SettingsPanel open={true} onClose={onClose} />);
        const radio = screen.getByTestId('theme-radio-system') as HTMLInputElement;
        expect(radio.checked).toBe(true);
    });

    it('shows the currently active theme radio as checked (light)', () => {
        mockUiState.theme = 'light';
        render(<SettingsPanel open={true} onClose={onClose} />);
        const radio = screen.getByTestId('theme-radio-light') as HTMLInputElement;
        expect(radio.checked).toBe(true);
    });

    it('shows the correct requestTimeoutMs in timeout input', () => {
        mockUiState.requestTimeoutMs = 5000;
        render(<SettingsPanel open={true} onClose={onClose} />);
        const input = screen.getByTestId('timeout-input') as HTMLInputElement;
        expect(input.value).toBe('5000');
    });

    it('checkbox for ssl verify reflects sslVerify=true', () => {
        mockUiState.sslVerify = true;
        render(<SettingsPanel open={true} onClose={onClose} />);
        const checkbox = screen.getByTestId('ssl-verify-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(true);
    });

    it('checkbox for ssl verify reflects sslVerify=false', () => {
        mockUiState.sslVerify = false;
        render(<SettingsPanel open={true} onClose={onClose} />);
        const checkbox = screen.getByTestId('ssl-verify-checkbox') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
    });

    it('shows current editorFontSize', () => {
        mockUiState.editorFontSize = 16;
        render(<SettingsPanel open={true} onClose={onClose} />);
        expect(screen.getByTestId('font-size-value')).toHaveTextContent('16');
    });

    // ─── Interaction tests ─────────────────────────────────────────────────────

    it('clicking overlay calls onClose', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('settings-overlay'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('clicking panel body does NOT call onClose (stopPropagation)', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('settings-panel'));
        expect(onClose).not.toHaveBeenCalled();
    });

    it('clicking close button calls onClose', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /close settings/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('selecting "Dark" theme radio calls setTheme("dark") and saveSetting', () => {
        mockUiState.theme = 'light';
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('theme-radio-dark'));
        expect(mockUiState.setTheme).toHaveBeenCalledWith('dark');
        expect(mockSaveSetting).toHaveBeenCalledWith('theme', 'dark');
    });

    it('changing timeout input calls setRequestTimeoutMs and saveSetting with clamped value', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        const input = screen.getByTestId('timeout-input');
        fireEvent.change(input, { target: { value: '5000' } });
        expect(mockUiState.setRequestTimeoutMs).toHaveBeenCalledWith(5000);
        expect(mockSaveSetting).toHaveBeenCalledWith('request_timeout_ms', 5000);
    });

    it('clamping: timeout below 100 is stored as 100', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        const input = screen.getByTestId('timeout-input');
        fireEvent.change(input, { target: { value: '10' } });
        expect(mockUiState.setRequestTimeoutMs).toHaveBeenCalledWith(100);
    });

    it('clamping: timeout above 300000 is stored as 300000', () => {
        render(<SettingsPanel open={true} onClose={onClose} />);
        const input = screen.getByTestId('timeout-input');
        fireEvent.change(input, { target: { value: '999999' } });
        expect(mockUiState.setRequestTimeoutMs).toHaveBeenCalledWith(300000);
    });

    it('toggling SSL checkbox calls setSslVerify and saveSetting', () => {
        mockUiState.sslVerify = true;
        render(<SettingsPanel open={true} onClose={onClose} />);
        const checkbox = screen.getByTestId('ssl-verify-checkbox');
        fireEvent.click(checkbox);
        expect(mockUiState.setSslVerify).toHaveBeenCalledWith(false);
        expect(mockSaveSetting).toHaveBeenCalledWith('ssl_verify', false);
    });

    it('clicking + font size button calls setEditorFontSize(n+1) and saveSetting', () => {
        mockUiState.editorFontSize = 14;
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('font-size-increase'));
        expect(mockUiState.setEditorFontSize).toHaveBeenCalledWith(15);
        expect(mockSaveSetting).toHaveBeenCalledWith('editor_font_size', 15);
    });

    it('clicking − at min font size (10) does NOT call setter (clamped)', () => {
        mockUiState.editorFontSize = 10;
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('font-size-decrease'));
        expect(mockUiState.setEditorFontSize).not.toHaveBeenCalled();
    });

    it('clicking + at max font size (24) does NOT call setter (clamped)', () => {
        mockUiState.editorFontSize = 24;
        render(<SettingsPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('font-size-increase'));
        expect(mockUiState.setEditorFontSize).not.toHaveBeenCalled();
    });
});
