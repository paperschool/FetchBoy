import { useState } from 'react';

const COMMON_STATUS_CODES = [
    { code: 200, label: '200 OK' },
    { code: 201, label: '201 Created' },
    { code: 204, label: '204 No Content' },
    { code: 301, label: '301 Moved Permanently' },
    { code: 302, label: '302 Found' },
    { code: 400, label: '400 Bad Request' },
    { code: 401, label: '401 Unauthorized' },
    { code: 403, label: '403 Forbidden' },
    { code: 404, label: '404 Not Found' },
    { code: 500, label: '500 Internal Server Error' },
    { code: 502, label: '502 Bad Gateway' },
    { code: 503, label: '503 Service Unavailable' },
];

interface Props {
    enabled: boolean;
    value: number;
    onChange: (enabled: boolean, value: number) => void;
}

export function StatusCodeEditor({ enabled, value, onChange }: Props) {
    const [customValue, setCustomValue] = useState('');

    const isCommon = COMMON_STATUS_CODES.some((c) => c.code === value);

    return (
        <div className="border-t border-app-subtle pt-4 mt-4 space-y-3">
            <div className="flex items-center gap-2">
                <input
                    type="checkbox"
                    id="sc-enabled"
                    checked={enabled}
                    onChange={(e) => onChange(e.target.checked, value)}
                    className="rounded"
                    data-testid="sc-enabled-checkbox"
                />
                <label htmlFor="sc-enabled" className="text-app-inverse text-sm font-medium">
                    Override status code
                </label>
            </div>

            {enabled && (
                <>
                    <div>
                        <label className="block text-app-muted text-xs mb-1" htmlFor="sc-select">
                            Status Code
                        </label>
                        <select
                            id="sc-select"
                            value={isCommon ? value : 'custom'}
                            onChange={(e) => {
                                if (e.target.value === 'custom') {
                                    setCustomValue(String(value));
                                } else {
                                    setCustomValue('');
                                    onChange(true, parseInt(e.target.value, 10));
                                }
                            }}
                            className="select-flat border-app-subtle bg-app-main text-app-primary h-8 w-full rounded-md border pl-2 pr-7 text-xs"
                            aria-label="Status Code"
                            data-testid="sc-select"
                        >
                            {COMMON_STATUS_CODES.map((sc) => (
                                <option key={sc.code} value={sc.code}>{sc.label}</option>
                            ))}
                            <option value="custom">Custom…</option>
                        </select>
                    </div>

                    {(!isCommon || customValue !== '') && (
                        <div>
                            <label className="block text-app-muted text-xs mb-1" htmlFor="sc-custom">
                                Custom value (100–599)
                            </label>
                            <input
                                id="sc-custom"
                                type="number"
                                min="100"
                                max="599"
                                value={customValue !== '' ? customValue : value}
                                onChange={(e) => {
                                    setCustomValue(e.target.value);
                                    const num = parseInt(e.target.value, 10);
                                    if (!isNaN(num) && num >= 100 && num <= 599) {
                                        onChange(true, num);
                                    }
                                }}
                                placeholder="100–599"
                                className="w-full bg-app-main text-app-inverse border border-app-subtle rounded px-2 py-1.5 text-sm"
                                aria-label="Custom status code"
                                data-testid="sc-custom-input"
                            />
                        </div>
                    )}

                    <p className="text-app-muted text-xs">
                        The original server status code is replaced with this value.
                    </p>
                </>
            )}
        </div>
    );
}
