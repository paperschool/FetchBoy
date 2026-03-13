import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestBlockerEditor } from './RequestBlockerEditor';

describe('RequestBlockerEditor', () => {
    it('renders the block request checkbox', () => {
        render(<RequestBlockerEditor onChange={vi.fn()} />);
        expect(screen.getByTestId('block-enabled-checkbox')).toBeInTheDocument();
    });

    it('checkbox is unchecked by default', () => {
        render(<RequestBlockerEditor onChange={vi.fn()} />);
        expect(screen.getByTestId('block-enabled-checkbox')).not.toBeChecked();
    });

    it('does not show status code select or body textarea when disabled', () => {
        render(<RequestBlockerEditor onChange={vi.fn()} />);
        expect(screen.queryByTestId('block-status-select')).not.toBeInTheDocument();
        expect(screen.queryByTestId('block-body-textarea')).not.toBeInTheDocument();
    });

    it('shows status code select and body textarea when enabled', () => {
        render(
            <RequestBlockerEditor
                onChange={vi.fn()}
                blockRequest={{ enabled: true, statusCode: 501, body: '' }}
            />,
        );
        expect(screen.getByTestId('block-status-select')).toBeInTheDocument();
        expect(screen.getByTestId('block-body-textarea')).toBeInTheDocument();
    });

    it('calls onChange with default values when enabled', () => {
        const onChange = vi.fn();
        render(<RequestBlockerEditor onChange={onChange} />);
        fireEvent.click(screen.getByTestId('block-enabled-checkbox'));
        expect(onChange).toHaveBeenCalledWith({ enabled: true, statusCode: 501, body: '' });
    });

    it('calls onChange with enabled=false and preserves values when disabled', () => {
        const onChange = vi.fn();
        render(
            <RequestBlockerEditor
                onChange={onChange}
                blockRequest={{ enabled: true, statusCode: 403, body: 'blocked' }}
            />,
        );
        fireEvent.click(screen.getByTestId('block-enabled-checkbox'));
        expect(onChange).toHaveBeenCalledWith({ enabled: false, statusCode: 403, body: 'blocked' });
    });

    it('calls onChange when status code is changed', () => {
        const onChange = vi.fn();
        render(
            <RequestBlockerEditor
                onChange={onChange}
                blockRequest={{ enabled: true, statusCode: 501, body: '' }}
            />,
        );
        fireEvent.change(screen.getByTestId('block-status-select'), { target: { value: '403' } });
        expect(onChange).toHaveBeenCalledWith({ enabled: true, statusCode: 403, body: '' });
    });

    it('calls onChange when body is changed', () => {
        const onChange = vi.fn();
        render(
            <RequestBlockerEditor
                onChange={onChange}
                blockRequest={{ enabled: true, statusCode: 501, body: '' }}
            />,
        );
        fireEvent.change(screen.getByTestId('block-body-textarea'), {
            target: { value: '{"error":"blocked"}' },
        });
        expect(onChange).toHaveBeenCalledWith({
            enabled: true,
            statusCode: 501,
            body: '{"error":"blocked"}',
        });
    });

    it('shows all expected status code options when enabled', () => {
        render(
            <RequestBlockerEditor
                onChange={vi.fn()}
                blockRequest={{ enabled: true, statusCode: 501, body: '' }}
            />,
        );
        const select = screen.getByTestId('block-status-select');
        expect(select).toHaveDisplayValue('501 Not Implemented');
    });

    it('shows "Blocks traffic" badge when enabled', () => {
        render(
            <RequestBlockerEditor
                onChange={vi.fn()}
                blockRequest={{ enabled: true, statusCode: 501, body: '' }}
            />,
        );
        expect(screen.getByTestId('block-active-badge')).toBeInTheDocument();
    });

    it('does not show "Blocks traffic" badge when disabled', () => {
        render(<RequestBlockerEditor onChange={vi.fn()} />);
        expect(screen.queryByTestId('block-active-badge')).not.toBeInTheDocument();
    });
});
