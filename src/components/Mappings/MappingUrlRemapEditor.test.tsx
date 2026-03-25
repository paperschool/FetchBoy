import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MappingUrlRemapEditor } from './MappingUrlRemapEditor';

const baseProps = {
    enabled: false,
    target: '',
    onChangeEnabled: vi.fn(),
    onChangeTarget: vi.fn(),
};

describe('MappingUrlRemapEditor', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders the enable checkbox unchecked', () => {
        render(<MappingUrlRemapEditor {...baseProps} />);
        expect(screen.getByTestId('remap-enabled-checkbox')).not.toBeChecked();
    });

    it('calls onChangeEnabled when checkbox is toggled', () => {
        render(<MappingUrlRemapEditor {...baseProps} />);
        fireEvent.click(screen.getByTestId('remap-enabled-checkbox'));
        expect(baseProps.onChangeEnabled).toHaveBeenCalledWith(true);
    });

    it('does not show target input when disabled', () => {
        render(<MappingUrlRemapEditor {...baseProps} />);
        expect(screen.queryByTestId('remap-target-input')).not.toBeInTheDocument();
    });

    it('shows target input when enabled', () => {
        render(<MappingUrlRemapEditor {...baseProps} enabled={true} />);
        expect(screen.getByTestId('remap-target-input')).toBeInTheDocument();
    });

    it('calls onChangeTarget when input changes', () => {
        render(<MappingUrlRemapEditor {...baseProps} enabled={true} />);
        fireEvent.change(screen.getByTestId('remap-target-input'), { target: { value: 'https://localhost:3000' } });
        expect(baseProps.onChangeTarget).toHaveBeenCalledWith('https://localhost:3000');
    });

    it('shows error for invalid URL', () => {
        render(<MappingUrlRemapEditor {...baseProps} enabled={true} target="not-a-url" />);
        expect(screen.getByTestId('remap-error')).toBeInTheDocument();
    });

    it('does not show error for valid URL', () => {
        render(<MappingUrlRemapEditor {...baseProps} enabled={true} target="https://localhost:3000" />);
        expect(screen.queryByTestId('remap-error')).not.toBeInTheDocument();
    });

    it('does not show error when target is empty (not yet typed)', () => {
        render(<MappingUrlRemapEditor {...baseProps} enabled={true} target="" />);
        expect(screen.queryByTestId('remap-error')).not.toBeInTheDocument();
    });
});
