import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

const CONTENT_TYPES = [
    'application/json',
    'text/plain',
    'application/xml',
    'text/html',
] as const;

export interface ResponseMapping {
    enabled: boolean;
    body: string;
    contentType: string;
}

interface Props {
    mapping: ResponseMapping;
    onChange: (mapping: ResponseMapping) => void;
}

export function ResponseMappingEditor({ mapping, onChange }: Props) {
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (mapping.contentType === 'application/json' && mapping.body.trim()) {
            try {
                JSON.parse(mapping.body);
                setError(null);
            } catch {
                setError('Invalid JSON');
            }
        } else {
            setError(null);
        }
    }, [mapping.body, mapping.contentType]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="rm-enabled"
                    checked={mapping.enabled}
                    onChange={(e) => onChange({ ...mapping, enabled: e.target.checked })}
                    className="rounded"
                    data-testid="rm-enabled-checkbox"
                />
                <label htmlFor="rm-enabled" className="text-app-inverse text-sm font-medium">
                    Override response body
                </label>
            </div>

            {mapping.enabled && (
                <>
                    <div>
                        <label className="block text-app-muted text-xs mb-1" htmlFor="rm-content-type">
                            Content-Type
                        </label>
                        <select
                            id="rm-content-type"
                            value={mapping.contentType}
                            onChange={(e) => onChange({ ...mapping, contentType: e.target.value })}
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-full rounded-md border pl-2 pr-7 text-xs"
                            aria-label="Content-Type"
                            data-testid="rm-content-type-select"
                        >
                            {CONTENT_TYPES.map((ct) => (
                                <option key={ct} value={ct}>{ct}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-app-muted text-xs mb-1" htmlFor="rm-body">
                            Response Body
                        </label>
                        <textarea
                            id="rm-body"
                            value={mapping.body}
                            onChange={(e) => onChange({ ...mapping, body: e.target.value })}
                            placeholder={
                                mapping.contentType === 'application/json'
                                    ? '{"message": "Custom response"}'
                                    : 'Enter response body…'
                            }
                            className="w-full h-40 bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-xs font-mono resize-y"
                            aria-label="Response Body"
                            data-testid="rm-body-textarea"
                        />
                        {error && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="rm-error">
                                <AlertCircle size={12} /> {error}
                            </p>
                        )}
                    </div>

                    <p className="text-app-muted text-xs">
                        The original server response is replaced with this body before forwarding to the client.
                    </p>
                </>
            )}
        </div>
    );
}
