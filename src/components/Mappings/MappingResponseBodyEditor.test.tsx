import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MappingResponseBodyEditor } from './MappingResponseBodyEditor';

// Mock Monaco editor
vi.mock('@monaco-editor/react', () => ({
    default: ({ value, onChange, ...props }: { value: string; onChange?: (v: string) => void; [k: string]: unknown }) => (
        <textarea
            data-testid="mock-monaco"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            {...(typeof props['data-testid'] === 'string' ? { 'data-testid': props['data-testid'] } : {})}
        />
    ),
}));

// Mock Tauri dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
    open: vi.fn().mockResolvedValue(null),
}));

const baseProps = {
    enabled: false,
    body: '',
    contentType: 'application/json',
    filePath: '',
    onChangeEnabled: vi.fn(),
    onChangeBody: vi.fn(),
    onChangeContentType: vi.fn(),
    onChangeFilePath: vi.fn(),
};

describe('MappingResponseBodyEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders the enable checkbox unchecked', () => {
        render(<MappingResponseBodyEditor {...baseProps} />);
        expect(screen.getByTestId('mrb-enabled-checkbox')).not.toBeChecked();
    });

    it('calls onChangeEnabled when checkbox is toggled', () => {
        render(<MappingResponseBodyEditor {...baseProps} />);
        fireEvent.click(screen.getByTestId('mrb-enabled-checkbox'));
        expect(baseProps.onChangeEnabled).toHaveBeenCalledWith(true);
    });

    it('does not show editor when disabled', () => {
        render(<MappingResponseBodyEditor {...baseProps} />);
        expect(screen.queryByTestId('mrb-mode-inline')).not.toBeInTheDocument();
    });

    it('shows mode buttons and content-type when enabled', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        expect(screen.getByTestId('mrb-mode-inline')).toBeInTheDocument();
        expect(screen.getByTestId('mrb-mode-file')).toBeInTheDocument();
        expect(screen.getByTestId('mrb-content-type')).toBeInTheDocument();
    });

    it('shows inline editor by default when enabled', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        expect(screen.getByTestId('mrb-inline-editor')).toBeInTheDocument();
    });

    it('switches to file mode', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        fireEvent.click(screen.getByTestId('mrb-mode-file'));
        expect(screen.getByTestId('mrb-file-editor')).toBeInTheDocument();
        expect(screen.getByTestId('mrb-file-path')).toBeInTheDocument();
        expect(screen.getByTestId('mrb-browse-btn')).toBeInTheDocument();
    });

    it('changes content-type', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        fireEvent.change(screen.getByTestId('mrb-content-type'), { target: { value: 'text/html' } });
        expect(baseProps.onChangeContentType).toHaveBeenCalledWith('text/html');
    });

    it('updates file path input', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        fireEvent.click(screen.getByTestId('mrb-mode-file'));
        fireEvent.change(screen.getByTestId('mrb-file-path'), { target: { value: '/tmp/mock.json' } });
        expect(baseProps.onChangeFilePath).toHaveBeenCalledWith('/tmp/mock.json');
        // Auto-detect content type from extension
        expect(baseProps.onChangeContentType).toHaveBeenCalledWith('application/json');
    });

    it('auto-detects xml content type from extension', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} />);
        fireEvent.click(screen.getByTestId('mrb-mode-file'));
        fireEvent.change(screen.getByTestId('mrb-file-path'), { target: { value: '/tmp/data.xml' } });
        expect(baseProps.onChangeContentType).toHaveBeenCalledWith('text/xml');
    });

    it('starts in file mode when filePath is pre-set', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} filePath="/tmp/test.json" />);
        expect(screen.getByTestId('mrb-file-editor')).toBeInTheDocument();
    });

    it('shows monaco editor in inline mode', () => {
        render(<MappingResponseBodyEditor {...baseProps} enabled={true} body='{"a":1}' />);
        expect(screen.getByTestId('mrb-inline-editor')).toBeInTheDocument();
    });
});
