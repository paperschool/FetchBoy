import { invoke } from '@tauri-apps/api/core';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { HighlightedUrlInput } from './HighlightedUrlInput';
import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import { ResponseViewer, type ResponseData } from '@/components/ResponseViewer/ResponseViewer';
import { SaveRequestDialog } from '@/components/SaveRequestDialog/SaveRequestDialog';
import { AuthPanel } from '@/components/AuthPanel/AuthPanel';
import { createFullSavedRequest, updateSavedRequest } from '@/lib/collections';
import { persistHistoryEntry } from '@/lib/history';
import type { AuthState, HttpMethod, RequestTab } from '@/stores/requestStore';
import { useRequestStore } from '@/stores/requestStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useEnvironment } from '@/hooks/useEnvironment';
import { useState } from 'react';

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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [responseData, setResponseData] = useState<ResponseData | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [sentUrl, setSentUrl] = useState<string | null>(null);
  const [verboseLogs, setVerboseLogs] = useState<string[]>([]);
  const [requestBodyLanguage, setRequestBodyLanguage] = useState<'json' | 'html' | 'xml'>('json');
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);
  const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs);
  const sslVerify = useUiSettingsStore((s) => s.sslVerify);

  const collectionStore = useCollectionStore();
  const historyStore = useHistoryStore();
  const { interpolate: applyEnv, unresolvedIn, activeVariables } = useEnvironment();

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
    setAuth,
    setBodyRaw,
    markDirty,
  } = useRequestStore();

  const unresolvedVars = unresolvedIn(url);

  const appendLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setVerboseLogs((current) => [...current, `[${timestamp}] ${message}`]);
  };

  function authStateToConfig(authState: AuthState): Record<string, string> {
    switch (authState.type) {
      case 'bearer': return { token: authState.token };
      case 'basic': return { username: authState.username, password: authState.password };
      case 'api-key': return { key: authState.key, value: authState.value, in: authState.in };
      default: return {};
    }
  }

  const handleDialogSave = async (saveName: string, collectionId: string, folderId: string | null) => {
    const existing = collectionStore.requests.find(
      (r) => r.name === saveName && r.collection_id === collectionId && (r.folder_id ?? null) === folderId,
    );

    if (existing) {
      if (!window.confirm('A request with this name already exists. Overwrite?')) return;
      await updateSavedRequest(existing.id, {
        name: saveName,
        method,
        url,
        headers,
        query_params: queryParams,
        body_type: body.mode,
        body_content: body.raw,
        auth_type: auth.type,
        auth_config: authStateToConfig(auth),
      });
      collectionStore.updateRequest(existing.id, {
        name: saveName,
        method,
        url,
        headers,
        query_params: queryParams,
        body_type: body.mode,
        body_content: body.raw,
        auth_type: auth.type,
        auth_config: authStateToConfig(auth),
      });
      collectionStore.setActiveRequest(existing.id);
    } else {
      const saved = await createFullSavedRequest({
        collection_id: collectionId,
        folder_id: folderId,
        name: saveName,
        method,
        url,
        headers,
        query_params: queryParams,
        body_type: body.mode,
        body_content: body.raw,
        auth_type: auth.type,
        auth_config: authStateToConfig(auth),
        sort_order: 0,
      });
      collectionStore.addRequest(saved);
      collectionStore.setActiveRequest(saved.id);
    }

    markDirty(false);
    setSaveDialogOpen(false);
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

    const sendUrl = applyEnv(normalizedUrl);
    const sendHeaders = headers.map((h) => ({ ...h, value: applyEnv(h.value) }));
    const sendQueryParams = queryParams.map((q) => ({ ...q, value: applyEnv(q.value) }));
    const sendBody = { ...body, raw: applyEnv(body.raw) };

    setIsSending(true);
    setRequestError(null);
    setResponseData(null);
    setSentUrl(sendUrl);

    const requestSnapshot = {
      id: crypto.randomUUID(),
      collection_id: null,
      folder_id: null,
      name: 'Untitled Request',
      method,
      url: sendUrl,
      headers: sendHeaders,
      query_params: sendQueryParams,
      body_type: sendBody.raw.trim() ? 'raw' : 'none',
      body_content: sendBody.raw,
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
            url: sendUrl,
            headers: sendHeaders,
            queryParams: sendQueryParams,
            body: sendBody,
            auth,
            timeout_ms: requestTimeoutMs,
            ssl_verify: sslVerify,
          },
        }),
        requestTimeoutMs + 5000,
      );

      appendLog(
        `Rust response received: status=${response.status}, time=${response.responseTimeMs}ms, size=${response.responseSizeBytes}bytes`,
      );

      setResponseData(response);

      const entry = await persistHistoryEntry({
        method,
        url: sendUrl,
        statusCode: response.status,
        responseTimeMs: Number(response.responseTimeMs),
        requestSnapshot,
      });
      historyStore.addEntry(entry);
      appendLog('History persisted for successful response.');
    } catch (error) {
      const reason = extractErrorReason(error);
      const message = `Request failed: ${reason}`;
      setRequestError(message);
      appendLog(`Send failed: ${reason}`);

      try {
        const errorEntry = await persistHistoryEntry({
          method,
          url: sendUrl,
          statusCode: 0,
          responseTimeMs: 0,
          requestSnapshot,
        });
        historyStore.addEntry(errorEntry);
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
      className="bg-app-main text-app-primary flex flex-col overflow-hidden p-4"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <p className="text-app-muted text-sm">Request Builder</p>

        <div className="grid grid-cols-[8rem_1fr_auto] items-start gap-3">
          <div>
            <label htmlFor="http-method" className="text-app-secondary mb-1 block text-xs font-medium">
              HTTP Method
            </label>
            <select
              id="http-method"
              aria-label="HTTP Method"
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
              className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm"
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
            <HighlightedUrlInput
              id="request-url"
              value={url}
              onChange={setUrl}
              placeholder="https://api.example.com"
              variables={activeVariables}
            />
            {unresolvedVars.length > 0 && (
              <p className="mt-1 text-xs text-orange-400">
                ⚠ Unresolved: {unresolvedVars.map((v) => `{{${v}}}`).join(', ')}
              </p>
            )}
          </div>

          <div>
            <p className="text-app-secondary mb-1 block text-xs font-medium">Controls</p>
            <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setSaveDialogOpen(true)}
              className="border-app-subtle text-app-secondary h-9 rounded-md border px-4 text-sm font-medium"
            >
              Save
            </button>
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
                      className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
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

            {activeTab === 'auth' ? (
              <AuthPanel auth={auth} onAuthChange={setAuth} />
            ) : null}
          </div>
        </details>

        <div className="flex min-h-0 flex-1 flex-col">
          <ResponseViewer
            response={responseData}
            error={requestError}
            logs={verboseLogs}
            onClearLogs={() => setVerboseLogs([])}
            requestedUrl={sentUrl ?? undefined}
          />
        </div>
      </div>

      <SaveRequestDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleDialogSave}
      />
    </main>
  );
}
