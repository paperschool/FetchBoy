import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SettingsAccordion } from './SettingsAccordion';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockStoreState } = vi.hoisted(() => {
    const mockStoreState = {
        theme: 'system' as 'light' | 'dark' | 'system',
        setTheme: vi.fn(),
        requestTimeoutMs: 30000,
        setRequestTimeoutMs: vi.fn(),
        sslVerify: true,
        setSslVerify: vi.fn(),
        editorFontSize: 13,
        setEditorFontSize: vi.fn(),
    };
    return { mockStoreState };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/stores/uiSettingsStore', () => ({
    useUiSettingsStore: (selector: (s: typeof mockStoreState) => unknown) =>
        selector(mockStoreState),
}));

vi.mock('@/lib/settings', () => ({
    saveSetting: vi.fn().mockResolvedValue(undefined),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsAccordion', () => {
    const mockOnToggle = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.theme = 'system';
        mockStoreState.requestTimeoutMs = 30000;
        mockStoreState.sslVerify = true;
        mockStoreState.editorFontSize = 13;
    });

    describe('toggle button', () => {
        it('renders the settings accordion toggle button', () => {
            render(<SettingsAccordion isExpanded={false} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('settings-accordion-toggle')).toBeInTheDocument();
        });

        it('toggle button is a button element (inherently keyboard accessible)', () => {
            render(<SettingsAccordion isExpanded={false} onToggle={mockOnToggle} />);
            const btn = screen.getByTestId('settings-accordion-toggle');
            expect(btn.tagName).toBe('BUTTON');
        });

        it('sets aria-expanded=false when collapsed', () => {
            render(<SettingsAccordion isExpanded={false} onToggle={mockOnToggle} />);
            const btn = screen.getByTestId('settings-accordion-toggle');
            expect(btn).toHaveAttribute('aria-expanded', 'false');
        });

        it('sets aria-expanded=true when expanded', () => {
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            const btn = screen.getByTestId('settings-accordion-toggle');
            expect(btn).toHaveAttribute('aria-expanded', 'true');
        });

        it('calls onToggle when toggle button is clicked', () => {
            render(<SettingsAccordion isExpanded={false} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('settings-accordion-toggle'));
            expect(mockOnToggle).toHaveBeenCalledTimes(1);
        });
    });

    describe('collapsed state', () => {
        it('does not show settings content when collapsed', () => {
            render(<SettingsAccordion isExpanded={false} onToggle={mockOnToggle} />);
            expect(screen.queryByTestId('settings-accordion-content')).not.toBeInTheDocument();
        });
    });

    describe('expanded state', () => {
        it('shows settings content when expanded', () => {
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('settings-accordion-content')).toBeInTheDocument();
        });

        it('shows theme radio buttons when expanded', () => {
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar-theme-radio-light')).toBeInTheDocument();
            expect(screen.getByTestId('sidebar-theme-radio-dark')).toBeInTheDocument();
            expect(screen.getByTestId('sidebar-theme-radio-system')).toBeInTheDocument();
        });

        it('reflects current theme from store', () => {
            mockStoreState.theme = 'dark';
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar-theme-radio-dark')).toBeChecked();
            expect(screen.getByTestId('sidebar-theme-radio-light')).not.toBeChecked();
        });

        it('calls setTheme and saveSetting when theme radio changes', async () => {
            const { saveSetting } = await import('@/lib/settings');
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('sidebar-theme-radio-dark'));
            expect(mockStoreState.setTheme).toHaveBeenCalledWith('dark');
            expect(saveSetting).toHaveBeenCalledWith('theme', 'dark');
        });

        it('shows timeout input with current value', () => {
            mockStoreState.requestTimeoutMs = 15000;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            const input = screen.getByTestId('sidebar-timeout-input') as HTMLInputElement;
            expect(input.value).toBe('15000');
        });

        it('shows SSL verify checkbox reflecting store state', () => {
            mockStoreState.sslVerify = false;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar-ssl-verify-checkbox')).not.toBeChecked();
        });

        it('shows font size value from store', () => {
            mockStoreState.editorFontSize = 16;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar-font-size-value')).toHaveTextContent('16');
        });

        it('calls setEditorFontSize when decrease button is clicked', async () => {
            const { saveSetting } = await import('@/lib/settings');
            mockStoreState.editorFontSize = 13;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('sidebar-font-size-decrease'));
            expect(mockStoreState.setEditorFontSize).toHaveBeenCalledWith(12);
            expect(saveSetting).toHaveBeenCalledWith('editor_font_size', 12);
        });

        it('calls setEditorFontSize when increase button is clicked', async () => {
            const { saveSetting } = await import('@/lib/settings');
            mockStoreState.editorFontSize = 13;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('sidebar-font-size-increase'));
            expect(mockStoreState.setEditorFontSize).toHaveBeenCalledWith(14);
            expect(saveSetting).toHaveBeenCalledWith('editor_font_size', 14);
        });

        it('does not decrease font size below minimum (10)', () => {
            mockStoreState.editorFontSize = 10;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('sidebar-font-size-decrease'));
            expect(mockStoreState.setEditorFontSize).not.toHaveBeenCalled();
        });

        it('does not increase font size above maximum (24)', () => {
            mockStoreState.editorFontSize = 24;
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            fireEvent.click(screen.getByTestId('sidebar-font-size-increase'));
            expect(mockStoreState.setEditorFontSize).not.toHaveBeenCalled();
        });

        it('shows keyboard shortcuts section', () => {
            render(<SettingsAccordion isExpanded={true} onToggle={mockOnToggle} />);
            expect(screen.getByTestId('sidebar-keyboard-shortcuts-section')).toBeInTheDocument();
        });
    });
});
