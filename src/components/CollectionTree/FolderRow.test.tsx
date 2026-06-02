import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { DndContext } from '@dnd-kit/core';
import { FolderRow } from './FolderRow';
import { useCollectionStore, type TreeFolder } from '@/stores/collectionStore';
import type { Collection, Folder, Request } from '@/lib/db';

const col: Collection = {
    id: 'col-1', name: 'C', description: '', created_at: 'ts', updated_at: 'ts',
};
const mkFld = (id: string, parent_id: string | null): Folder => ({
    id, collection_id: 'col-1', parent_id, name: `Level ${id}`, sort_order: 0,
    created_at: 'ts', updated_at: 'ts',
});

function buildTopFolder(folders: Folder[], requests: Request[] = []): TreeFolder {
    useCollectionStore.setState({ collections: [col], folders, requests, activeRequestId: null });
    const tree = useCollectionStore.getState().getCollectionTree();
    return tree[0].folders[0];
}

const noop = () => {};

function renderFolder(node: TreeFolder, expandedFolders: Record<string, boolean>) {
    const editRef = createRef<HTMLInputElement>();
    return render(
        <DndContext>
            <FolderRow
                node={node}
                colId="col-1"
                expandedFolders={expandedFolders}
                editingId={null}
                editingValue=""
                editRef={editRef}
                activeRequestId={null}
                onToggleFolder={noop}
                onEditChange={noop}
                onEditFolder={noop}
                onCommitEdit={noop}
                onCancelEdit={noop}
                onAddRequest={noop}
                onAddSubFolder={noop}
                onDeleteFolder={noop}
                onSelectRequest={noop}
                onDeleteRequest={noop}
                onUpdateRequest={noop}
                onOpenRequestInNewTab={noop}
            />
        </DndContext>,
    );
}

describe('FolderRow nesting', () => {
    beforeEach(() => {
        useCollectionStore.setState({ collections: [], folders: [], requests: [], activeRequestId: null });
    });

    it('renders all 5 levels with increasing depth when every level is expanded', () => {
        const folders = [0, 1, 2, 3, 4].map((d) => mkFld(`${d}`, d === 0 ? null : `${d - 1}`));
        const node = buildTopFolder(folders);
        const expanded = Object.fromEntries(folders.map((f) => [f.id, true]));

        renderFolder(node, expanded);

        // every level present
        for (let d = 0; d < 5; d++) {
            const el = screen.getByTestId(`folder-${d}`);
            expect(el).toBeInTheDocument();
            expect(el.getAttribute('data-depth')).toBe(String(d));
        }
    });

    it('collapsed parent hides deeper levels (independent expand state)', () => {
        const folders = [0, 1, 2].map((d) => mkFld(`${d}`, d === 0 ? null : `${d - 1}`));
        const node = buildTopFolder(folders);
        // expand only the top level → children of fld-0 render, but fld-1's children (fld-2) hidden
        renderFolder(node, { '0': true, '1': false });

        expect(screen.getByTestId('folder-0')).toBeInTheDocument();
        expect(screen.getByTestId('folder-1')).toBeInTheDocument();
        expect(screen.queryByTestId('folder-2')).toBeNull();
    });

    it('flat single folder (no sub-folders) renders just itself', () => {
        const node = buildTopFolder([mkFld('solo', null)]);
        renderFolder(node, { solo: true });
        expect(screen.getByTestId('folder-solo')).toBeInTheDocument();
        expect(screen.getByTestId('folder-solo').getAttribute('data-depth')).toBe('0');
    });
});
