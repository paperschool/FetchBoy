import { AlertCircle } from 'lucide-react';

interface Props {
    enabled: boolean;
    target: string;
    onChangeEnabled: (v: boolean) => void;
    onChangeTarget: (v: string) => void;
}

function validateUrl(url: string): string | null {
    if (!url.trim()) return 'Target URL is required when remap is enabled';
    try {
        new URL(url);
        return null;
    } catch {
        return 'Must be a valid URL (e.g. https://localhost:3000)';
    }
}

export function MappingUrlRemapEditor({ enabled, target, onChangeEnabled, onChangeTarget }: Props) {
    const error = enabled && target.trim() ? validateUrl(target) : null;

    return (
        <div className="space-y-3" data-testid="mapping-url-remap-editor">
            <div className="flex items-center gap-2">
                <input type="checkbox" id="remap-enabled" checked={enabled}
                    onChange={(e) => onChangeEnabled(e.target.checked)}
                    data-testid="remap-enabled-checkbox" />
                <label htmlFor="remap-enabled" className="text-app-inverse text-sm font-medium">
                    Enable URL remapping
                </label>
            </div>

            {enabled && (
                <>
                    <div>
                        <label className="block text-app-muted text-xs mb-1">Target URL</label>
                        <input type="text" value={target}
                            onChange={(e) => onChangeTarget(e.target.value)}
                            placeholder="https://localhost:3000/api/..."
                            className={`w-full bg-app-main text-app-inverse border rounded px-2 py-1.5 text-sm font-mono ${error ? 'border-red-400' : 'border-app-subtle'}`}
                            data-testid="remap-target-input" />
                        {error && (
                            <p className="text-red-400 text-xs mt-1 flex items-center gap-1" data-testid="remap-error">
                                <AlertCircle size={12} /> {error}
                            </p>
                        )}
                    </div>
                    <p className="text-app-muted text-xs">
                        Matching requests will be forwarded to this URL instead of the original destination.
                        The path after the matched pattern is preserved.
                    </p>
                </>
            )}
        </div>
    );
}
