import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MappingHeadersEditor } from './MappingHeadersEditor';
import type { MappingHeader } from '@/lib/db';

const empty: MappingHeader[] = [];
const single: MappingHeader[] = [{ key: 'X-Auth', value: 'token123', enabled: true }];

describe('MappingHeadersEditor', () => {
    describe('Add Headers section', () => {
        it('renders the Add Header button', () => {
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('add-header-btn')).toBeInTheDocument();
        });

        it('adds a new empty header row on click', () => {
            const onAdd = vi.fn();
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={empty} onChangeAdd={onAdd} onChangeRemove={vi.fn()} />);
            fireEvent.click(screen.getByTestId('add-header-btn'));
            expect(onAdd).toHaveBeenCalledWith([{ key: '', value: '', enabled: true }]);
        });

        it('renders existing headers with key-value-enabled inputs', () => {
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('add-header-key-0')).toHaveValue('X-Auth');
            expect(screen.getByTestId('add-header-value-0')).toHaveValue('token123');
        });

        it('calls onChangeAdd when key changes', () => {
            const onAdd = vi.fn();
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={onAdd} onChangeRemove={vi.fn()} />);
            fireEvent.change(screen.getByTestId('add-header-key-0'), { target: { value: 'X-Custom' } });
            expect(onAdd).toHaveBeenCalledWith([{ key: 'X-Custom', value: 'token123', enabled: true }]);
        });

        it('calls onChangeAdd when value changes', () => {
            const onAdd = vi.fn();
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={onAdd} onChangeRemove={vi.fn()} />);
            fireEvent.change(screen.getByTestId('add-header-value-0'), { target: { value: 'newval' } });
            expect(onAdd).toHaveBeenCalledWith([{ key: 'X-Auth', value: 'newval', enabled: true }]);
        });

        it('removes a header row', () => {
            const onAdd = vi.fn();
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={onAdd} onChangeRemove={vi.fn()} />);
            fireEvent.click(screen.getByTestId('add-header-remove-0'));
            expect(onAdd).toHaveBeenCalledWith([]);
        });

        it('toggles enable checkbox', () => {
            const onAdd = vi.fn();
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={onAdd} onChangeRemove={vi.fn()} />);
            fireEvent.click(screen.getByTestId('add-header-enabled-0'));
            expect(onAdd).toHaveBeenCalledWith([{ key: 'X-Auth', value: 'token123', enabled: false }]);
        });

        it('shows error when enabled header has empty key', () => {
            const headers: MappingHeader[] = [{ key: '', value: 'v', enabled: true }];
            render(<MappingHeadersEditor headersAdd={headers} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('add-headers-error')).toBeInTheDocument();
        });

        it('does not show error when disabled header has empty key', () => {
            const headers: MappingHeader[] = [{ key: '', value: 'v', enabled: false }];
            render(<MappingHeadersEditor headersAdd={headers} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.queryByTestId('add-headers-error')).not.toBeInTheDocument();
        });
    });

    describe('Remove Headers section', () => {
        it('renders the Add Header Name button', () => {
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('add-remove-header-btn')).toBeInTheDocument();
        });

        it('adds a new remove header row', () => {
            const onRemove = vi.fn();
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={onRemove} />);
            fireEvent.click(screen.getByTestId('add-remove-header-btn'));
            expect(onRemove).toHaveBeenCalledWith([{ key: '', value: '', enabled: true }]);
        });

        it('updates remove header name', () => {
            const onRemove = vi.fn();
            const removeHeaders: MappingHeader[] = [{ key: 'X-Old', value: '', enabled: true }];
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={removeHeaders} onChangeAdd={vi.fn()} onChangeRemove={onRemove} />);
            fireEvent.change(screen.getByTestId('remove-header-name-0'), { target: { value: 'X-New' } });
            expect(onRemove).toHaveBeenCalledWith([{ key: 'X-New', value: '', enabled: true }]);
        });

        it('removes a remove header row', () => {
            const onRemove = vi.fn();
            const removeHeaders: MappingHeader[] = [{ key: 'X-Strip', value: '', enabled: true }];
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={removeHeaders} onChangeAdd={vi.fn()} onChangeRemove={onRemove} />);
            fireEvent.click(screen.getByTestId('remove-header-remove-0'));
            expect(onRemove).toHaveBeenCalledWith([]);
        });

        it('shows error when remove header name is empty', () => {
            const removeHeaders: MappingHeader[] = [{ key: '', value: '', enabled: true }];
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={removeHeaders} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('remove-headers-empty-error')).toBeInTheDocument();
        });

        it('shows error for duplicate remove header names', () => {
            const removeHeaders: MappingHeader[] = [
                { key: 'X-Dup', value: '', enabled: true },
                { key: 'x-dup', value: '', enabled: true },
            ];
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={removeHeaders} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('remove-headers-dup-error')).toBeInTheDocument();
        });
    });

    describe('Collapsible sections', () => {
        it('toggles Add Headers section', () => {
            render(<MappingHeadersEditor headersAdd={single} headersRemove={empty} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('add-header-key-0')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('add-headers-toggle'));
            expect(screen.queryByTestId('add-header-key-0')).not.toBeInTheDocument();
        });

        it('toggles Remove Headers section', () => {
            const removeHeaders: MappingHeader[] = [{ key: 'X-Strip', value: '', enabled: true }];
            render(<MappingHeadersEditor headersAdd={empty} headersRemove={removeHeaders} onChangeAdd={vi.fn()} onChangeRemove={vi.fn()} />);
            expect(screen.getByTestId('remove-header-name-0')).toBeInTheDocument();
            fireEvent.click(screen.getByTestId('remove-headers-toggle'));
            expect(screen.queryByTestId('remove-header-name-0')).not.toBeInTheDocument();
        });
    });
});
