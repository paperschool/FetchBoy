import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useEffect, useMemo, useState } from 'react';

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
  logs?: string[];
  onClearLogs?: () => void;
  requestedUrl?: string;
}

type ResponseTab = 'body' | 'headers' | 'logs';
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

export function ResponseViewer({ response, error, logs = [], onClearLogs, requestedUrl }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [responseBodyLanguage, setResponseBodyLanguage] = useState<'json' | 'html' | 'xml'>('json');
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);

  const formattedJsonBody = useMemo(() => {
    if (!response) {
      return null;
    }

    try {
      return JSON.stringify(JSON.parse(response.body) as unknown, null, 2);
    } catch {
      return null;
    }
  }, [response]);

  useEffect(() => {
    if (formattedJsonBody) {
      setResponseBodyLanguage('json');
    }
  }, [formattedJsonBody]);

  if (!response && !error && logs.length === 0) {
    return null;
  }

  return (
    <section data-testid="response-viewer" className="border-app-subtle flex h-full flex-col gap-3 rounded-md border p-3">
      {response && (
        <div className="space-y-1">
          {requestedUrl && (
            <p className="font-medium text-sm">
              Requested Url:{' '}
              <span className="text-app-muted break-all text-xs">
                {requestedUrl}
                </span>
            </p>
          )}
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
        </div>
      )}

      {error && (
        <>
          <p className="text-sm font-medium text-red-600">Request Error</p>
          <p className="text-sm text-red-600">{error}</p>
        </>
      )}

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
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`rounded-t-md px-3 py-2 text-sm ${
              activeTab === 'logs'
                ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                : 'text-app-muted hover:text-app-primary'
            }`}
          >
            Logs {logs.length > 0 ? `(${logs.length})` : ''}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === 'body' && response ? (
        <div className="relative min-h-0 flex-1">
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            <label htmlFor="response-body-language" className="text-app-secondary text-xs font-medium">
              Language
            </label>
            <select
              id="response-body-language"
              aria-label="Response Body Language"
              value={responseBodyLanguage}
              onChange={(event) => setResponseBodyLanguage(event.target.value as 'json' | 'html' | 'xml')}
              className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
            >
              <option value="json">JSON</option>
              <option value="html">HTML</option>
              <option value="xml">XML</option>
            </select>
          </div>

          <MonacoEditorField
            testId="response-body-editor"
            path="response-body"
            language={responseBodyLanguage}
            value={formattedJsonBody ?? response.body}
            fontSize={editorFontSize}
            height="100%"
            readOnly
          />
        </div>
      ) : activeTab === 'body' ? (
        <p className="text-app-muted text-sm">Send a request to see the response body.</p>
      ) : null}

      {activeTab === 'headers' && response ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
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
      ) : activeTab === 'headers' ? (
        <p className="text-app-muted text-sm">Send a request to see response headers.</p>
      ) : null}

      {activeTab === 'logs' ? (
        <div className="relative min-h-0 flex-1">
          <div className="absolute top-2 right-2 z-10">
            <button
              type="button"
              onClick={onClearLogs}
              className="border-app-subtle text-app-secondary rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Clear Logs
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-app-muted text-xs">No logs yet. Click Send to capture runtime details.</p>
          ) : (
            <pre className="bg-app-main text-app-secondary h-full overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">
              {logs.join('\n')}
            </pre>
          )}
        </div>
      ) : null}
      </div>
    </section>
  );
}
