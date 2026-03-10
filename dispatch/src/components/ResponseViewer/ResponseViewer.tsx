import { useMemo, useState } from 'react';

export interface ResponseHeaderRow {
  key: string;
  value: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  responseTimeMs: number;
  responseSizeBytes: number;
  body: string;
  headers: ResponseHeaderRow[];
}

interface ResponseViewerProps {
  response: ResponseData | null;
  error: string | null;
}

type ResponseTab = 'body' | 'headers';
type BodyViewMode = 'raw' | 'json';

function formatPrimitive(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return `"${value}"`;
  }
  return String(value);
}

function JsonNode({ label, value }: { label?: string; value: unknown }) {
  const isArray = Array.isArray(value);
  const isObject = typeof value === 'object' && value !== null && !isArray;

  if (!isArray && !isObject) {
    return (
      <p className="text-app-primary text-xs">
        {label ? <span className="text-app-secondary">{label}: </span> : null}
        {formatPrimitive(value)}
      </p>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((entry, index) => [String(index), entry] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <details open className="ml-2">
      <summary className="text-app-secondary cursor-pointer text-xs font-medium">
        {label ? `${label}: ` : ''}
        {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
      </summary>
      <div className="border-app-subtle mt-1 space-y-1 border-l pl-2">
        {entries.map(([entryKey, entryValue]) => (
          <JsonNode key={entryKey} label={entryKey} value={entryValue} />
        ))}
      </div>
    </details>
  );
}

function getStatusColorClass(status: number): string {
  if (status >= 200 && status < 300) {
    return 'text-green-600';
  }
  if (status >= 400 && status < 500) {
    return 'text-yellow-600';
  }
  if (status >= 500) {
    return 'text-red-600';
  }
  return 'text-app-primary';
}

export function ResponseViewer({ response, error }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [bodyViewMode, setBodyViewMode] = useState<BodyViewMode>('raw');

  const parsedJsonBody = useMemo(() => {
    if (!response) {
      return { isValid: false, value: null as unknown };
    }

    try {
      return { isValid: true, value: JSON.parse(response.body) as unknown };
    } catch {
      return { isValid: false, value: null as unknown };
    }
  }, [response]);

  if (!response && !error) {
    return null;
  }

  if (error) {
    return (
      <section data-testid="response-viewer" className="border-app-subtle space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium text-red-600">Request Error</p>
        <p className="text-app-secondary text-sm">{error}</p>
      </section>
    );
  }

  if (!response) {
    return null;
  }

  return (
    <section data-testid="response-viewer" className="border-app-subtle space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <p className="font-medium">
          Status:{' '}
          <span className={getStatusColorClass(response.status)}>
            {response.status} {response.statusText}
          </span>
        </p>
        <p className="text-app-secondary">Time: {response.responseTimeMs} ms</p>
        <p className="text-app-secondary">Size: {response.responseSizeBytes} bytes</p>
      </div>

      <div className="border-app-subtle border-b">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('body')}
            className={`rounded-t-md px-3 py-2 text-sm ${
              activeTab === 'body'
                ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                : 'text-app-muted hover:text-app-primary'
            }`}
          >
            Body
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('headers')}
            className={`rounded-t-md px-3 py-2 text-sm ${
              activeTab === 'headers'
                ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                : 'text-app-muted hover:text-app-primary'
            }`}
          >
            Headers
          </button>
        </div>
      </div>

      {activeTab === 'body' ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBodyViewMode('raw')}
              className={`rounded-md px-2 py-1 text-xs ${
                bodyViewMode === 'raw'
                  ? 'border-app-subtle bg-app-main text-app-primary border font-medium'
                  : 'text-app-muted hover:text-app-primary'
              }`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setBodyViewMode('json')}
              className={`rounded-md px-2 py-1 text-xs ${
                bodyViewMode === 'json'
                  ? 'border-app-subtle bg-app-main text-app-primary border font-medium'
                  : 'text-app-muted hover:text-app-primary'
              }`}
            >
              JSON
            </button>
          </div>

          {bodyViewMode === 'raw' ? (
            <pre className="border-app-subtle text-app-primary max-h-64 overflow-auto rounded-md border p-3 text-xs whitespace-pre-wrap">
              {response.body}
            </pre>
          ) : null}

          {bodyViewMode === 'json' ? (
            parsedJsonBody.isValid ? (
              <div className="border-app-subtle max-h-64 overflow-auto rounded-md border p-2" data-testid="response-json-view">
                <JsonNode value={parsedJsonBody.value} />
              </div>
            ) : (
              <p className="text-app-muted text-xs">Response body is not valid JSON.</p>
            )
          ) : null}
        </div>
      ) : null}

      {activeTab === 'headers' ? (
        <div className="space-y-2">
          {response.headers.length === 0 ? (
            <p className="text-app-muted text-sm">No headers returned.</p>
          ) : (
            response.headers.map((header, index) => (
              <div
                key={`${header.key}-${index}`}
                className="border-app-subtle grid grid-cols-[minmax(140px,_220px)_1fr] gap-2 rounded-md border p-2"
              >
                <p className="text-app-secondary text-sm font-medium">{header.key}</p>
                <p className="text-app-primary text-sm break-all">{header.value}</p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
