import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCollectionStore } from '@/stores/collectionStore';
import type { Collection, Folder } from '@/lib/db';
import { SaveRequestDialog } from './SaveRequestDialog';

const makeCol = (o: Partial<Collection> = {}): Collection => ({
    id: 'col-1',
    name: 'My API',
    description: '',
    created_at: '',
    updated_at: '',
    ...o,
});

const makeFld = (o: Partial<Folder> = {}): Folder => ({
    id: 'fld-1',
    collection_id: 'col-1',
    parent_id: null,
    name: 'Auth',
    sort_order: 0,
    created_at: '',
    updated_at: '',
    ...o,
});

const resetStore = () =>
    useCollectionStore.setState({
        collections: [],
        folders: [],
        requests: [],
        activeRequestId: null,
    });

describe('SaveRequestDialog', () => {
    beforeEach(() => {
        resetStore();
        vi.clearAllMocks();
    });

    it('does not render when open is false', () => {
        const onClose = vi.fn();
        const onSave = vi.fn();
        render(<SaveRequestDialog open={false} onClose={onClose} onSave={onSave} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open is true', () => {
        const onClose = vi.fn();
        const onSave = vi.fn();
        render(<SaveRequestDialog open={true} onClose={onClose} onSave={onSave} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Save Request')).toBeInTheDocument();
    });

    it('renders collection list from store', () => {
        useCollectionStore.setState({ collections: [makeCol(), makeCol({ id: 'col-2', name: 'Second API' })] });
        const onClose = vi.fn();
        const onSave = vi.fn();
        render(<SaveRequestDialog open={true} onClose={onClose} onSave={onSave} />);
        expect(screen.getByText('My API')).toBeInTheDocument();
        expect(screen.getByText('Second API')).toBeInTheDocument();
    });

    it('Save button is disabled when name is empty', () => {
        useCollectionStore.setState({ collections: [makeCol()] });
        const onSave = vi.fn();
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        // Select a collection but leave name empty
        fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'col-1' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('Save button is disabled when no collection selected', () => {
        const onSave = vi.fn();
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Request Name'), { target: { value: 'My Request' } });
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it('Save button is enabled when name and collection are provided', () => {
        useCollectionStore.setState({ collections: [makeCol()] });
        const onSave = vi.fn();
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Request Name'), { target: { value: 'My Request' } });
        fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'col-1' } });
        expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });

    it('calls onSave with trimmed name, collectionId, and null folderId when no folder selected', async () => {
        useCollectionStore.setState({ collections: [makeCol()] });
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Request Name'), { target: { value: '  Get Users  ' } });
        fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'col-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith('Get Users', 'col-1', null);
        });
    });

    it('calls onSave with correct folderId when folder is selected', async () => {
        useCollectionStore.setState({ collections: [makeCol()], folders: [makeFld()] });
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        fireEvent.change(screen.getByLabelText('Request Name'), { target: { value: 'My Request' } });
        fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'col-1' } });
        fireEvent.change(screen.getByLabelText('Folder (optional)'), { target: { value: 'fld-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => {
            expect(onSave).toHaveBeenCalledWith('My Request', 'col-1', 'fld-1');
        });
    });

    it('folder selector only shows folders for selected collection', () => {
        useCollectionStore.setState({
            collections: [makeCol(), makeCol({ id: 'col-2', name: 'Other' })],
            folders: [makeFld(), makeFld({ id: 'fld-2', collection_id: 'col-2', name: 'Other Folder' })],
        });
        render(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={vi.fn()} />);
        fireEvent.change(screen.getByLabelText('Collection'), { target: { value: 'col-1' } });
        expect(screen.getByText('Auth')).toBeInTheDocument();
        expect(screen.queryByText('Other Folder')).not.toBeInTheDocument();
    });

    it('cancel button calls onClose', () => {
        const onClose = vi.fn();
        render(<SaveRequestDialog open={true} onClose={onClose} onSave={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('clicking the backdrop calls onClose', () => {
        const onClose = vi.fn();
        render(<SaveRequestDialog open={true} onClose={onClose} onSave={vi.fn()} />);
        const backdrop = screen.getByRole('dialog').parentElement!;
        fireEvent.click(backdrop);
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('resets name and collection when reopened', async () => {
        useCollectionStore.setState({ collections: [makeCol()] });
        const onSave = vi.fn().mockResolvedValue(undefined);
        const { rerender } = render(
            <SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />,
        );
        fireEvent.change(screen.getByLabelText('Request Name'), { target: { value: 'Old Name' } });
        // Close then reopen
        rerender(<SaveRequestDialog open={false} onClose={vi.fn()} onSave={onSave} />);
        rerender(<SaveRequestDialog open={true} onClose={vi.fn()} onSave={onSave} />);
        expect((screen.getByLabelText('Request Name') as HTMLInputElement).value).toBe('');
    });
});
