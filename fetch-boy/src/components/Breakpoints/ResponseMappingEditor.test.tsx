import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ResponseMappingEditor } from './ResponseMappingEditor';
import type { ResponseMapping } from './ResponseMappingEditor';

const defaultMapping: ResponseMapping = {
    enabled: false,
    body: '',
    contentType: 'application/json',
};

describe('ResponseMappingEditor', () => {
    it('renders the enable checkbox', () => {
        render(<ResponseMappingEditor mapping={defaultMapping} onChange={vi.fn()} />);
        expect(screen.getByTestId('rm-enabled-checkbox')).toBeInTheDocument();
    });

    it('does not show body/content-type fields when disabled', () => {
        render(<ResponseMappingEditor mapping={defaultMapping} onChange={vi.fn()} />);
        expect(screen.queryByTestId('rm-body-textarea')).not.toBeInTheDocument();
        expect(screen.queryByTestId('rm-content-type-select')).not.toBeInTheDocument();
    });

    it('shows body and content-type fields when enabled', () => {
        render(
            <ResponseMappingEditor
                mapping={{ ...defaultMapping, enabled: true }}
                onChange={vi.fn()}
            />
        );
        expect(screen.getByTestId('rm-body-textarea')).toBeInTheDocument();
        expect(screen.getByTestId('rm-content-type-select')).toBeInTheDocument();
    });

    it('calls onChange when enable checkbox is toggled', () => {
        const onChange = vi.fn();
        render(<ResponseMappingEditor mapping={defaultMapping} onChange={onChange} />);
        fireEvent.click(screen.getByTestId('rm-enabled-checkbox'));
        expect(onChange).toHaveBeenCalledWith({ ...defaultMapping, enabled: true });
    });

    it('calls onChange when body is edited', () => {
        const onChange = vi.fn();
        render(
            <ResponseMappingEditor
                mapping={{ ...defaultMapping, enabled: true }}
                onChange={onChange}
            />
        );
        fireEvent.change(screen.getByTestId('rm-body-textarea'), {
            target: { value: '{"ok":true}' },
        });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ body: '{"ok":true}' }),
        );
    });

    it('calls onChange when content-type is changed', () => {
        const onChange = vi.fn();
        render(
            <ResponseMappingEditor
                mapping={{ ...defaultMapping, enabled: true }}
                onChange={onChange}
            />
        );
        fireEvent.change(screen.getByTestId('rm-content-type-select'), {
            target: { value: 'text/plain' },
        });
        expect(onChange).toHaveBeenCalledWith(
            expect.objectContaining({ contentType: 'text/plain' }),
        );
    });

    it('shows JSON validation error for invalid JSON body', async () => {
        render(
            <ResponseMappingEditor
                mapping={{ enabled: true, body: '{invalid', contentType: 'application/json' }}
                onChange={vi.fn()}
            />
        );
        expect(await screen.findByTestId('rm-error')).toBeInTheDocument();
        expect(screen.getByTestId('rm-error')).toHaveTextContent('Invalid JSON');
    });

    it('clears JSON error for valid JSON body', async () => {
        const { rerender } = render(
            <ResponseMappingEditor
                mapping={{ enabled: true, body: '{invalid', contentType: 'application/json' }}
                onChange={vi.fn()}
            />
        );
        expect(await screen.findByTestId('rm-error')).toBeInTheDocument();
        rerender(
            <ResponseMappingEditor
                mapping={{ enabled: true, body: '{"ok":true}', contentType: 'application/json' }}
                onChange={vi.fn()}
            />
        );
        expect(screen.queryByTestId('rm-error')).not.toBeInTheDocument();
    });

    it('does not show JSON error for non-JSON content type', async () => {
        render(
            <ResponseMappingEditor
                mapping={{ enabled: true, body: 'not json', contentType: 'text/plain' }}
                onChange={vi.fn()}
            />
        );
        // Wait a tick for effect
        await act(async () => {});
        expect(screen.queryByTestId('rm-error')).not.toBeInTheDocument();
    });

    it('does not show JSON error for empty body', async () => {
        render(
            <ResponseMappingEditor
                mapping={{ enabled: true, body: '', contentType: 'application/json' }}
                onChange={vi.fn()}
            />
        );
        await act(async () => {});
        expect(screen.queryByTestId('rm-error')).not.toBeInTheDocument();
    });
});
