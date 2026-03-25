import { useState } from 'react';
import { FolderOpen } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

type BodyMode = 'inline' | 'file';

const CONTENT_TYPES = [
    { value: 'application/json', label: 'JSON', lang: 'json' as const },
    { value: 'text/xml', label: 'XML', lang: 'xml' as const },
    { value: 'text/html', label: 'HTML', lang: 'html' as const },
    { value: 'text/plain', label: 'Plain Text', lang: 'plaintext' as const },
    { value: 'image/png', label: 'PNG', lang: 'plaintext' as const },
    { value: 'image/jpeg', label: 'JPEG', lang: 'plaintext' as const },
    { value: 'image/gif', label: 'GIF', lang: 'plaintext' as const },
    { value: 'image/svg+xml', label: 'SVG', lang: 'xml' as const },
    { value: 'image/webp', label: 'WebP', lang: 'plaintext' as const },
];

const EXT_MAP: Record<string, string> = {
    '.json': 'application/json',
    '.xml': 'text/xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
};

function detectContentType(filePath: string): string | null {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return EXT_MAP[ext] ?? null;
}

interface Props {
    enabled: boolean;
    body: string;
    contentType: string;
    filePath: string;
    onChangeEnabled: (v: boolean) => void;
    onChangeBody: (v: string) => void;
    onChangeContentType: (v: string) => void;
    onChangeFilePath: (v: string) => void;
}

export function MappingResponseBodyEditor({
    enabled, body, contentType, filePath,
    onChangeEnabled, onChangeBody, onChangeContentType, onChangeFilePath,
}: Props) {
    const fontSize = useUiSettingsStore((s) => s.editorFontSize);
    const [mode, setMode] = useState<BodyMode>(filePath ? 'file' : 'inline');

    const langEntry = CONTENT_TYPES.find((c) => c.value === contentType) ?? CONTENT_TYPES[3];

    const handleBrowse = async () => {
        const selected = await openDialog({
            multiple: false,
            filters: [
                { name: 'JSON', extensions: ['json'] },
                { name: 'XML', extensions: ['xml'] },
                { name: 'HTML', extensions: ['html', 'htm'] },
                { name: 'Text', extensions: ['txt'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });
        if (!selected) return;
        const path = typeof selected === 'string' ? selected : selected[0];
        onChangeFilePath(path);
        const detected = detectContentType(path);
        if (detected) onChangeContentType(detected);
    };

    return (
        <div className="space-y-3" data-testid="mapping-response-body-editor">
            <div className="flex items-center gap-2">
                <input type="checkbox" id="mrb-enabled" checked={enabled}
                    onChange={(e) => onChangeEnabled(e.target.checked)}
                    data-testid="mrb-enabled-checkbox" />
                <label htmlFor="mrb-enabled" className="text-app-inverse text-sm font-medium">
                    Override response body
                </label>
            </div>

            {enabled && (
                <>
                    <div className="flex gap-1">
                        {(['inline', 'file'] as const).map((m) => (
                            <button key={m} type="button" onClick={() => setMode(m)}
                                className={`px-3 py-1 text-xs rounded ${mode === m ? 'bg-app-accent text-white' : 'bg-app-subtle text-app-muted hover:text-app-inverse'}`}
                                data-testid={`mrb-mode-${m}`}>
                                {m === 'inline' ? 'Inline' : 'File'}
                            </button>
                        ))}
                    </div>

                    <div>
                        <label className="block text-app-muted text-xs mb-1">Content-Type</label>
                        <select value={contentType} onChange={(e) => onChangeContentType(e.target.value)}
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-full rounded-md border pl-2 pr-7 text-xs"
                            data-testid="mrb-content-type">
                            {CONTENT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label} ({ct.value})</option>)}
                        </select>
                    </div>

                    {mode === 'inline' && (
                        <div data-testid="mrb-inline-editor">
                            <MonacoEditorField
                                value={body}
                                language={langEntry.lang}
                                fontSize={fontSize}
                                path="mapping-response-body"
                                testId="mrb-monaco"
                                height="200px"
                                onChange={onChangeBody}
                            />
                        </div>
                    )}

                    {mode === 'file' && (
                        <div className="space-y-2" data-testid="mrb-file-editor">
                            <div className="flex gap-2">
                                <input type="text" value={filePath}
                                    onChange={(e) => {
                                        onChangeFilePath(e.target.value);
                                        const detected = detectContentType(e.target.value);
                                        if (detected) onChangeContentType(detected);
                                    }}
                                    placeholder="/path/to/response.json"
                                    className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
                                    data-testid="mrb-file-path" />
                                <button type="button" onClick={() => void handleBrowse()}
                                    className="px-3 py-1.5 bg-app-subtle text-app-inverse rounded hover:bg-app-subtle/80 flex items-center gap-1 text-xs"
                                    data-testid="mrb-browse-btn">
                                    <FolderOpen size={14} /> Browse
                                </button>
                            </div>
                            <p className="text-app-muted text-xs">File is read at request time (not cached). Falls back to inline body if file not found.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
