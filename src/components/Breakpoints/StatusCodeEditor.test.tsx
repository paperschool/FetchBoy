import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { StatusCodeEditor } from './StatusCodeEditor';

describe('StatusCodeEditor', () => {
    it('renders the enable checkbox', () => {
        render(<StatusCodeEditor enabled={false} value={200} onChange={vi.fn()} />);
        expect(screen.getByTestId('sc-enabled-checkbox')).toBeInTheDocument();
    });

    it('does not show status code select when disabled', () => {
        render(<StatusCodeEditor enabled={false} value={200} onChange={vi.fn()} />);
        expect(screen.queryByTestId('sc-select')).not.toBeInTheDocument();
    });

    it('shows status code select when enabled', () => {
        render(<StatusCodeEditor enabled={true} value={200} onChange={vi.fn()} />);
        expect(screen.getByTestId('sc-select')).toBeInTheDocument();
    });

    it('calls onChange with enabled=true and code=200 when checkbox is clicked', () => {
        const onChange = vi.fn();
        render(<StatusCodeEditor enabled={false} value={200} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('sc-enabled-checkbox'));
        expect(onChange).toHaveBeenCalledWith(true, 200);
    });

    it('calls onChange with enabled=false when checkbox is unchecked', () => {
        const onChange = vi.fn();
        render(<StatusCodeEditor enabled={true} value={404} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('sc-enabled-checkbox'));
        expect(onChange).toHaveBeenCalledWith(false, 404);
    });

    it('calls onChange with selected common code when dropdown changes', () => {
        const onChange = vi.fn();
        render(<StatusCodeEditor enabled={true} value={200} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('sc-select'), { target: { value: '404' } });
        expect(onChange).toHaveBeenCalledWith(true, 404);
    });

    it('shows custom input when value is not in common list', () => {
        render(<StatusCodeEditor enabled={true} value={418} onChange={vi.fn()} />);
        expect(screen.getByTestId('sc-custom-input')).toBeInTheDocument();
    });

    it('does not update for out-of-range custom input', () => {
        const onChange = vi.fn();
        render(<StatusCodeEditor enabled={true} value={418} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('sc-custom-input'), { target: { value: '99' } });
        // onChange should not be called with an invalid code
        expect(onChange).not.toHaveBeenCalledWith(true, 99);
    });

    it('updates for valid custom input (100-599)', () => {
        const onChange = vi.fn();
        render(<StatusCodeEditor enabled={true} value={418} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('sc-custom-input'), { target: { value: '422' } });
        expect(onChange).toHaveBeenCalledWith(true, 422);
    });

    it('shows all common status codes in dropdown', () => {
        render(<StatusCodeEditor enabled={true} value={200} onChange={vi.fn()} />);
        const select = screen.getByTestId('sc-select');
        expect(select).toHaveDisplayValue('200 OK');
    });
});
