import { useEffect, useState } from 'react';
import { useMappingsStore } from '@/stores/mappingsStore';
import { t } from '@/lib/i18n';

interface Props {
    open: boolean;
    onClose: () => void;
    onSave: (name: string, urlPattern: string, folderId: string | null) => Promise<void>;
    defaultName?: string;
    defaultUrlPattern?: string;
}

export function SaveMappingDialog({ open, onClose, onSave, defaultName = '', defaultUrlPattern = '' }: Props) {
    const [name, setName] = useState('');
    const [urlPattern, setUrlPattern] = useState('');
    const [folderId, setFolderId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const folders = useMappingsStore((s) => s.folders);

    useEffect(() => {
        if (open) {
            setName(defaultName);
            setUrlPattern(defaultUrlPattern);
            setFolderId(null);
            setSaving(false);
        }
    }, [open, defaultName, defaultUrlPattern]);

    if (!open) return null;

    const canSave = name.trim().length > 0 && urlPattern.trim().length > 0;

    const handleSave = async () => {
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave(name.trim(), urlPattern.trim(), folderId);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-app-main border border-app-subtle rounded-md p-6 w-96 space-y-4"
                role="dialog" aria-modal="true" aria-labelledby="save-map-dialog-title">
                <h2 id="save-map-dialog-title" className="text-app-primary text-sm font-semibold">
                    {t('mappings.new')}
                </h2>
                <div className="space-y-3">
                    <div>
                        <label htmlFor="map-name" className="text-app-secondary mb-1 block text-xs font-medium">{t('mappings.name')}</label>
                        <input id="map-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Mock users endpoint"
                            className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-3 text-sm"
                            autoFocus data-testid="save-map-name-input" />
                    </div>
                    <div>
                        <label htmlFor="map-url-pattern" className="text-app-secondary mb-1 block text-xs font-medium">{t('mappings.urlPattern')}</label>
                        <input id="map-url-pattern" type="text" value={urlPattern} onChange={(e) => setUrlPattern(e.target.value)}
                            placeholder="e.g. api/users"
                            className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-3 text-sm font-mono"
                            data-testid="save-map-url-input" />
                        <p className="text-app-muted text-xs mt-1">Partial match -- edit after saving for exact/regex.</p>
                    </div>
                    <div>
                        <label htmlFor="map-folder" className="text-app-secondary mb-1 block text-xs font-medium">{t('common.folder')}</label>
                        <select id="map-folder" value={folderId ?? ''} onChange={(e) => setFolderId(e.target.value || null)}
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm"
                            data-testid="save-map-folder-select">
                            <option value="">{t('common.rootNoFolder')}</option>
                            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose}
                        className="border-app-subtle text-app-secondary h-9 rounded-md border px-4 text-sm">{t('common.cancel')}</button>
                    <button type="button" onClick={() => void handleSave()} disabled={!canSave || saving}
                        className="bg-app-topbar text-app-inverse disabled:text-app-muted h-9 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                        data-testid="save-map-confirm-button">
                        {saving ? t('common.saving') : t('common.saveAndEdit')}
                    </button>
                </div>
            </div>
        </div>
    );
}
