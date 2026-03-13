import { Ban } from 'lucide-react';

const BLOCK_STATUS_CODES = [
    { code: 501, label: '501 Not Implemented' },
    { code: 403, label: '403 Forbidden' },
    { code: 404, label: '404 Not Found' },
    { code: 500, label: '500 Internal Server Error' },
    { code: 503, label: '503 Service Unavailable' },
    { code: 418, label: "418 I'm a teapot" },
];

const DEFAULT_STATUS = 501;

interface BlockRequest {
    enabled: boolean;
    statusCode: number;
    body: string;
}

interface Props {
    blockRequest?: BlockRequest;
    onChange: (blockRequest: BlockRequest) => void;
}

export function RequestBlockerEditor({ blockRequest, onChange }: Props) {
    const isEnabled = blockRequest?.enabled ?? false;
    const statusCode = blockRequest?.statusCode ?? DEFAULT_STATUS;
    const body = blockRequest?.body ?? '';

    return (
        <div className="border-t border-app-subtle pt-4 mt-4">
            <div className="flex items-center gap-2 mb-3">
                <input
                    type="checkbox"
                    id="block-enabled"
                    checked={isEnabled}
                    onChange={(e) => onChange({ enabled: e.target.checked, statusCode, body })}
                    className="rounded"
                    data-testid="block-enabled-checkbox"
                />
                <label htmlFor="block-enabled" className="text-app-inverse text-sm font-medium">
                    Block Request
                </label>
                {isEnabled && (
                    <span
                        className="ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400"
                        data-testid="block-active-badge"
                    >
                        <Ban size={10} />
                        Blocks traffic
                    </span>
                )}
            </div>

            {isEnabled && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-app-muted text-xs mb-1" htmlFor="block-status">
                            Block Response Status
                        </label>
                        <select
                            id="block-status"
                            value={statusCode}
                            onChange={(e) =>
                                onChange({ enabled: true, statusCode: parseInt(e.target.value, 10), body })
                            }
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-full rounded-md border pl-2 pr-7 text-xs"
                            data-testid="block-status-select"
                        >
                            {BLOCK_STATUS_CODES.map((sc) => (
                                <option key={sc.code} value={sc.code}>{sc.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-app-muted text-xs mb-1" htmlFor="block-body">
                            Block Response Body (optional)
                        </label>
                        <textarea
                            id="block-body"
                            value={body}
                            onChange={(e) => onChange({ enabled: true, statusCode, body: e.target.value })}
                            placeholder='{"error": "This endpoint is blocked for testing"}'
                            rows={3}
                            className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm font-mono"
                            data-testid="block-body-textarea"
                        />
                    </div>

                    <p className="text-app-muted text-xs">
                        Matching requests are not forwarded to the server. The client receives the block response above.
                    </p>
                </div>
            )}
        </div>
    );
}
