import { AlertCircle } from 'lucide-react';
import type { BreakpointHeader } from '@/lib/db';

interface Props {
    headers: BreakpointHeader[];
    onChange: (headers: BreakpointHeader[]) => void;
}

export function HeadersEditor({ headers, onChange }: Props) {
    const addHeader = () => {
        onChange([...headers, { key: '', value: '', enabled: true }]);
    };

    const updateHeader = (index: number, field: keyof BreakpointHeader, val: string | boolean) => {
        const updated = headers.map((h, i) => (i === index ? { ...h, [field]: val } : h));
        onChange(updated);
    };

    const removeHeader = (index: number) => {
        onChange(headers.filter((_, i) => i !== index));
    };

    const hasEmptyKey = headers.some((h) => h.enabled && h.key.trim() === '');

    return (
        <div className="border-t border-app-subtle pt-4 mt-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-app-inverse text-sm font-medium">Custom Headers</span>
                <button
                    type="button"
                    onClick={addHeader}
                    className="text-xs text-app-accent hover:underline"
                    data-testid="add-header-btn"
                >
                    + Add Header
                </button>
            </div>

            {headers.length > 0 && (
                <div className="space-y-2" data-testid="headers-list">
                    {headers.map((header, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={header.enabled}
                                onChange={(e) => updateHeader(index, 'enabled', e.target.checked)}
                                className="shrink-0"
                                aria-label={`Enable header ${index + 1}`}
                                data-testid={`header-enabled-${index}`}
                            />
                            <input
                                type="text"
                                value={header.key}
                                onChange={(e) => updateHeader(index, 'key', e.target.value)}
                                placeholder="Header-Name"
                                className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
                                aria-label={`Header name ${index + 1}`}
                                data-testid={`header-key-${index}`}
                            />
                            <input
                                type="text"
                                value={header.value}
                                onChange={(e) => updateHeader(index, 'value', e.target.value)}
                                placeholder="Value"
                                className="flex-1 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1 text-sm"
                                aria-label={`Header value ${index + 1}`}
                                data-testid={`header-value-${index}`}
                            />
                            <button
                                type="button"
                                onClick={() => removeHeader(index)}
                                className="text-red-400 hover:text-red-300 shrink-0"
                                aria-label={`Remove header ${index + 1}`}
                                data-testid={`header-remove-${index}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {hasEmptyKey && (
                <p className="text-red-400 text-xs flex items-center gap-1" data-testid="headers-error">
                    <AlertCircle size={12} /> Enabled headers must have a name
                </p>
            )}

            {headers.length > 0 && (
                <p className="text-app-muted text-xs">
                    Custom headers are injected into the response before forwarding to the client.
                </p>
            )}
        </div>
    );
}
