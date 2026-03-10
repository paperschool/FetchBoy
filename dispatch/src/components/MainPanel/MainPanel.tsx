import { invoke } from '@tauri-apps/api/core';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import { ResponseViewer, type ResponseData } from '@/components/ResponseViewer/ResponseViewer';
import { persistHistoryEntry } from '@/lib/history';
import type { HttpMethod, RequestTab } from '@/stores/requestStore';
import { useRequestStore } from '@/stores/requestStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useState } from 'react';

const SEND_TIMEOUT_MS = 15000;

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const REQUEST_TABS: Array<{ id: RequestTab; label: string }> = [
  { id: 'headers', label: 'Headers' },
  { id: 'query', label: 'Query Params' },
  { id: 'body', label: 'Body' },
  { id: 'auth', label: 'Auth' },
];

function extractErrorReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage =
      'message' in error && typeof error.message === 'string'
        ? error.message
        : 'error' in error && typeof error.error === 'string'
          ? error.error
          : null;

    if (maybeMessage && maybeMessage.trim().length > 0) {
      return maybeMessage;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  return 'Unknown error';
}

export function MainPanel() {
  const [isSending, setIsSending] = useState(false);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [verboseLogs, setVerboseLogs] = useState<string[]>([]);
  const [requestBodyLanguage, setRequestBodyLanguage] = useState<'json' | 'html' | 'xml'>('json');
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);

  const {
    method,
    setMethod,
    url,
    setUrl,
    activeTab,
    setActiveTab,
    headers,
    addHeader,
    updateHeader,
    toggleHeaderEnabled,
    removeHeader,
    queryParams,
    addQueryParam,
    updateQueryParam,
    toggleQueryParamEnabled,
    removeQueryParam,
    body,
    auth,
    setBodyRaw,
  } = useRequestStore();

  const appendLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setVerboseLogs((current) => [...current, `[${timestamp}] ${message}`]);
  };

  const invokeWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Timed out after ${timeoutMs}ms waiting for Rust response`));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timeoutHandle);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  };

  const handleSendRequest = async () => {
    const rawUrl = url.trim();
    appendLog(`Send clicked with method=${method}, rawUrl=${rawUrl || '<empty>'}`);

    if (!rawUrl) {
      setRequestError('Please enter a URL first.');
      setResponseData(null);
      appendLog('Validation failed: URL is empty.');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    appendLog(`Normalized URL: ${normalizedUrl}`);

    setIsSending(true);
    setRequestError(null);
    setResponseData(null);

    const requestSnapshot = {
      id: crypto.randomUUID(),
      collection_id: null,
      folder_id: null,
      name: 'Untitled Request',
      method,
      url: normalizedUrl,
      headers,
      query_params: queryParams,
      body_type: body.raw.trim() ? 'raw' : 'none',
      body_content: body.raw,
      auth_type: auth.type,
      auth_config: {},
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as const;

    try {
      appendLog('Invoking Rust command: send_request');
      const response = await invokeWithTimeout(
        invoke<ResponseData>('send_request', {
          request: {
            method,
            url: normalizedUrl,
            headers,
            queryParams,
            body,
            auth,
          },
        }),
        SEND_TIMEOUT_MS,
      );

      appendLog(
        `Rust response received: status=${response.status}, time=${response.responseTimeMs}ms, size=${response.responseSizeBytes}bytes`,
      );

      setResponseData(response);

      await persistHistoryEntry({
        method,
        url: normalizedUrl,
        statusCode: response.status,
        responseTimeMs: Number(response.responseTimeMs),
        requestSnapshot,
      });
      appendLog('History persisted for successful response.');
    } catch (error) {
      const reason = extractErrorReason(error);
      const message = `Request failed: ${reason}`;
      setRequestError(message);
      appendLog(`Send failed: ${reason}`);

      try {
        await persistHistoryEntry({
          method,
          url: normalizedUrl,
          statusCode: 0,
          responseTimeMs: 0,
          requestSnapshot,
        });
        appendLog('History persisted for failed response.');
      } catch {
        // Keep UI focused on request failure; history persistence errors should not crash send flow.
        appendLog('History persistence failed after request failure.');
      }
    } finally {
      setIsSending(false);
      appendLog('Send flow completed.');
    }
  };

  return (
    <main
      data-testid="main-panel"
      className="bg-app-main text-app-primary overflow-auto p-4"
    >
      <div className="space-y-4">
        <p className="text-app-muted text-sm">Request Builder</p>

        <div className="grid grid-cols-[8rem_1fr_auto] gap-3">
          <div>
            <label htmlFor="http-method" className="text-app-secondary mb-1 block text-xs font-medium">
              HTTP Method
            </label>
            <select
              id="http-method"
              aria-label="HTTP Method"
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
              className="border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border px-2 text-sm"
            >
              {HTTP_METHODS.map((httpMethod) => (
                <option key={httpMethod} value={httpMethod}>
                  {httpMethod}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="request-url" className="text-app-secondary mb-1 block text-xs font-medium">
              Request URL
            </label>
            <input
              id="request-url"
              aria-label="Request URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://api.example.com"
              className="border-app-subtle text-app-primary h-9 w-full rounded-md border px-3 text-sm"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleSendRequest}
              disabled={isSending}
              className="bg-app-topbar text-app-inverse disabled:text-app-muted h-9 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>

        <details open className="border-app-subtle rounded-md border p-2" data-testid="request-details-accordion">
          <summary className="text-app-secondary cursor-pointer text-sm font-medium">Request Details</summary>
          <div className="mt-3 space-y-3">
            <div className="border-app-subtle border-b">
              <div className="flex gap-2">
                {REQUEST_TABS.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`rounded-t-md px-3 py-2 text-sm ${
                        isActive
                          ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                          : 'text-app-muted hover:text-app-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {activeTab === 'headers' ? (
              <KeyValueRows
                sectionName="headers"
                rows={headers}
                addLabel="Add Header"
                onAdd={addHeader}
                onUpdate={updateHeader}
                onToggleEnabled={toggleHeaderEnabled}
                onRemove={removeHeader}
              />
            ) : null}

            {activeTab === 'query' ? (
              <KeyValueRows
                sectionName="query"
                rows={queryParams}
                addLabel="Add Query Param"
                onAdd={addQueryParam}
                onUpdate={updateQueryParam}
                onToggleEnabled={toggleQueryParamEnabled}
                onRemove={removeQueryParam}
              />
            ) : null}

            {activeTab === 'body' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-app-secondary block text-sm font-medium">
                    Request Body
                  </label>
                  <div className="flex items-center gap-2">
                    <label htmlFor="request-body-language" className="text-app-secondary text-xs font-medium">
                      Language
                    </label>
                    <select
                      id="request-body-language"
                      aria-label="Request Body Language"
                      value={requestBodyLanguage}
                      onChange={(event) => setRequestBodyLanguage(event.target.value as 'json' | 'html' | 'xml')}
                      className="border-app-subtle bg-app-main text-app-primary h-8 rounded-md border px-2 text-xs"
                    >
                      <option value="json">JSON</option>
                      <option value="html">HTML</option>
                      <option value="xml">XML</option>
                    </select>
                  </div>
                </div>

                <MonacoEditorField
                  testId="request-body-editor"
                  path="request-body"
                  language={requestBodyLanguage}
                  value={body.raw}
                  fontSize={editorFontSize}
                  onChange={setBodyRaw}
                />
              </div>
            ) : null}

            {activeTab === 'auth' ? <p className="text-app-muted text-sm">Auth: None</p> : null}
          </div>
        </details>

        <ResponseViewer
          response={responseData}
          error={requestError}
          logs={verboseLogs}
          onClearLogs={() => setVerboseLogs([])}
        />
      </div>
    </main>
  );
}
