import { useEffect, useState } from 'react';
import { useCollectionStore } from '@/stores/collectionStore';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (name: string, collectionId: string, folderId: string | null) => Promise<void>;
}

export function SaveRequestDialog({ open, onClose, onSave }: Props) {
    const [name, setName] = useState('');
    const [collectionId, setCollectionId] = useState('');
    const [folderId, setFolderId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const collections = useCollectionStore((state) => state.collections);
    const folders = useCollectionStore((state) => state.folders);

    const availableFolders = folders.filter((f) => f.collection_id === collectionId);

    useEffect(() => {
        if (open) {
            setName('');
            setCollectionId('');
            setFolderId(null);
            setSaving(false);
        }
    }, [open]);

    if (!open) return null;

    const canSave = name.trim().length > 0 && collectionId.length > 0;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave(name.trim(), collectionId, folderId);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="bg-app-main border-app-subtle rounded-md border p-6 w-96 space-y-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-dialog-title"
            >
                <h2 id="save-dialog-title" className="text-app-primary text-sm font-semibold">
                    Save Request
                </h2>

                <div className="space-y-3">
                    <div>
                        <label
                            htmlFor="save-request-name"
                            className="text-app-secondary mb-1 block text-xs font-medium"
                        >
                            Request Name
                        </label>
                        <input
                            id="save-request-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Get Users"
                            className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-3 text-sm"
                            autoFocus
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="save-collection"
                            className="text-app-secondary mb-1 block text-xs font-medium"
                        >
                            Collection
                        </label>
                        <select
                            id="save-collection"
                            value={collectionId}
                            onChange={(e) => {
                                setCollectionId(e.target.value);
                                setFolderId(null);
                            }}
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm"
                        >
                            <option value="">Select a collection...</option>
                            {collections.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {availableFolders.length > 0 && (
                        <div>
                            <label
                                htmlFor="save-folder"
                                className="text-app-secondary mb-1 block text-xs font-medium"
                            >
                                Folder (optional)
                            </label>
                            <select
                                id="save-folder"
                                value={folderId ?? ''}
                                onChange={(e) => setFolderId(e.target.value || null)}
                                className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm"
                            >
                                <option value="">No folder</option>
                                {availableFolders.map((f) => (
                                    <option key={f.id} value={f.id}>
                                        {f.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="border-app-subtle text-app-secondary h-9 rounded-md border px-4 text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={!canSave || saving}
                        className="bg-app-topbar text-app-inverse disabled:text-app-muted h-9 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
