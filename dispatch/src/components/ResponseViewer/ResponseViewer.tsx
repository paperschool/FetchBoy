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
}

type ResponseTab = 'body' | 'headers';
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
          <div className="flex items-center justify-end gap-2">
            <label htmlFor="response-body-language" className="text-app-secondary text-xs font-medium">
              Language
            </label>
            <select
              id="response-body-language"
              aria-label="Response Body Language"
              value={responseBodyLanguage}
              onChange={(event) => setResponseBodyLanguage(event.target.value as 'json' | 'html' | 'xml')}
              className="border-app-subtle bg-app-main text-app-primary h-8 rounded-md border px-2 text-xs"
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
            readOnly
          />
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
