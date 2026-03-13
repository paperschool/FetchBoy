import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { HeadersEditor } from './HeadersEditor';
import type { BreakpointHeader } from '@/lib/db';

const emptyHeaders: BreakpointHeader[] = [];
const singleHeader: BreakpointHeader[] = [{ key: 'X-Test', value: 'test-value', enabled: true }];

describe('HeadersEditor', () => {
    it('renders the Add Header button', () => {
        render(<HeadersEditor headers={emptyHeaders} onChange={vi.fn()} />);
        expect(screen.getByTestId('add-header-btn')).toBeInTheDocument();
    });

    it('calls onChange with a new empty header on Add Header click', () => {
        const onChange = vi.fn();
        render(<HeadersEditor headers={emptyHeaders} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('add-header-btn'));
        expect(onChange).toHaveBeenCalledWith([{ key: '', value: '', enabled: true }]);
    });

    it('renders existing headers', () => {
        render(<HeadersEditor headers={singleHeader} onChange={vi.fn()} />);
        expect(screen.getByTestId('header-key-0')).toHaveValue('X-Test');
        expect(screen.getByTestId('header-value-0')).toHaveValue('test-value');
    });

    it('calls onChange when header key changes', () => {
        const onChange = vi.fn();
        render(<HeadersEditor headers={singleHeader} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('header-key-0'), { target: { value: 'X-Custom' } });
        expect(onChange).toHaveBeenCalledWith([{ key: 'X-Custom', value: 'test-value', enabled: true }]);
    });

    it('calls onChange when header value changes', () => {
        const onChange = vi.fn();
        render(<HeadersEditor headers={singleHeader} onChange={onChange} />);
        fireEvent.change(screen.getByTestId('header-value-0'), { target: { value: 'new-val' } });
        expect(onChange).toHaveBeenCalledWith([{ key: 'X-Test', value: 'new-val', enabled: true }]);
    });

    it('calls onChange with header removed on remove button click', () => {
        const onChange = vi.fn();
        render(<HeadersEditor headers={singleHeader} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('header-remove-0'));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it('toggles header enabled via checkbox', () => {
        const onChange = vi.fn();
        render(<HeadersEditor headers={singleHeader} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('header-enabled-0'));
        expect(onChange).toHaveBeenCalledWith([{ key: 'X-Test', value: 'test-value', enabled: false }]);
    });

    it('shows validation error when an enabled header has an empty key', () => {
        const headers: BreakpointHeader[] = [{ key: '', value: 'val', enabled: true }];
        render(<HeadersEditor headers={headers} onChange={vi.fn()} />);
        expect(screen.getByTestId('headers-error')).toBeInTheDocument();
    });

    it('does not show validation error when disabled header has empty key', () => {
        const headers: BreakpointHeader[] = [{ key: '', value: 'val', enabled: false }];
        render(<HeadersEditor headers={headers} onChange={vi.fn()} />);
        expect(screen.queryByTestId('headers-error')).not.toBeInTheDocument();
    });

    it('does not show validation error for valid headers', () => {
        render(<HeadersEditor headers={singleHeader} onChange={vi.fn()} />);
        expect(screen.queryByTestId('headers-error')).not.toBeInTheDocument();
    });

    it('renders multiple headers correctly', () => {
        const headers: BreakpointHeader[] = [
            { key: 'X-First', value: 'first', enabled: true },
            { key: 'X-Second', value: 'second', enabled: false },
        ];
        render(<HeadersEditor headers={headers} onChange={vi.fn()} />);
        expect(screen.getByTestId('header-key-0')).toHaveValue('X-First');
        expect(screen.getByTestId('header-key-1')).toHaveValue('X-Second');
    });
});
