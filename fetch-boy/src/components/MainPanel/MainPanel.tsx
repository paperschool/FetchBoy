import { invoke } from '@tauri-apps/api/core';
import { Save, Send } from 'lucide-react';
import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { CopyAsButton } from './CopyAsButton';
import { HighlightedUrlInput } from './HighlightedUrlInput';
import type { ResolvedRequest } from '@/lib/generateSnippet';
import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import { ResponseViewer, type ResponseData } from '@/components/ResponseViewer/ResponseViewer';
import { SaveRequestDialog } from '@/components/SaveRequestDialog/SaveRequestDialog';
import { AuthPanel } from '@/components/AuthPanel/AuthPanel';
import { createFullSavedRequest, updateSavedRequest } from '@/lib/collections';
import { extractQueryParamsFromUrl } from '@/lib/extractQueryParamsFromUrl';
import { persistHistoryEntry } from '@/lib/history';
import type { AuthState, HttpMethod, RequestTab } from '@/stores/requestStore';
import { useTabStore } from '@/stores/tabStore';
import { useActiveRequestState, useActiveResponseState } from '@/hooks/useActiveTabState';
import { useCollectionStore } from '@/stores/collectionStore';
import { useHistoryStore } from '@/stores/historyStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useEnvironment } from '@/hooks/useEnvironment';
import { useEffect, useState } from 'react';

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

function buildRequestedUrlForDisplay(
  baseUrl: string,
  queryParams: Array<{ key: string; value: string; enabled: boolean }>,
  auth: AuthState,
): string {
  try {
    const parsedUrl = new URL(baseUrl);

    for (const param of queryParams) {
      if (param.enabled && param.key.trim().length > 0) {
        parsedUrl.searchParams.append(param.key, param.value);
      }
    }

    if (auth.type === 'api-key' && auth.in === 'query' && auth.key.trim().length > 0) {
      parsedUrl.searchParams.append(auth.key, auth.value);
    }

    return parsedUrl.toString();
  } catch {
    return baseUrl;
  }
}

function parseUrlWithFallback(rawUrl: string): URL | null {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return null;
    }

    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function stripQueryFromUrl(rawUrl: string): string {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) {
    const hashIndex = rawUrl.indexOf('#');
    const beforeHash = hashIndex >= 0 ? rawUrl.slice(0, hashIndex) : rawUrl;
    const hash = hashIndex >= 0 ? rawUrl.slice(hashIndex) : '';
    const queryIndex = beforeHash.indexOf('?');
    const withoutQuery = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
    return `${withoutQuery}${hash}`;
  }

  parsedUrl.search = '';
  return parsedUrl.toString();
}

function buildUrlFromQueryParams(
  rawUrl: string,
  params: Array<{ key: string; value: string; enabled: boolean }>,
): string | null {
  const parsedUrl = parseUrlWithFallback(rawUrl);
  if (!parsedUrl) {
    return null;
  }

  parsedUrl.search = '';
  for (const param of params) {
    if (param.enabled && param.key.trim().length > 0) {
      parsedUrl.searchParams.append(param.key, param.value);
    }
  }

  return parsedUrl.toString();
}

function areQueryParamsEqual(
  left: Array<{ key: string; value: string; enabled: boolean }>,
  right: Array<{ key: string; value: string; enabled: boolean }>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((row, index) => {
    const other = right[index];
    return row.key === other.key && row.value === other.value && row.enabled === other.enabled;
  });
}

export function MainPanel() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [queryMatchError, setQueryMatchError] = useState<string | null>(null);
  const [syncQueryParams, setSyncQueryParams] = useState(false);
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(true);
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);
  const requestTimeoutMs = useUiSettingsStore((s) => s.requestTimeoutMs);
  const sslVerify = useUiSettingsStore((s) => s.sslVerify);

  const collectionStore = useCollectionStore();
  const historyStore = useHistoryStore();
  const { interpolate: applyEnv, unresolvedIn, activeVariables } = useEnvironment();

  const { state: req, update: updateReq } = useActiveRequestState();
  const { state: res, update: updateRes } = useActiveResponseState();

  // Request state destructuring
  const method = req.method;
  const url = req.url;
  const headers = req.headers;
  const queryParams = req.queryParams;
  const body = req.body;
  const auth = req.auth;
  const activeTab = req.activeTab;
  const isDirty = req.isDirty;

  // Request state setters (adapted from requestStore actions)
  const setMethod = (m: HttpMethod) => updateReq({ method: m, isDirty: true });
  const setUrl = (u: string) => {
    setQueryMatchError(null);
    updateReq({ url: u, isDirty: true });
  };
  const setActiveTab = (t: RequestTab) => updateReq({ activeTab: t });
  const addHeader = () => updateReq({ headers: [...req.headers, { key: '', value: '', enabled: true }], isDirty: true });
  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = req.headers.map((h, i) => i === index ? { ...h, [field]: value } : h);
    updateReq({ headers: newHeaders, isDirty: true });
  };
  const toggleHeaderEnabled = (index: number) => {
    const newH = req.headers.map((h, i) => i === index ? { ...h, enabled: !h.enabled } : h);
    updateReq({ headers: newH, isDirty: true });
  };
  const removeHeader = (index: number) => updateReq({ headers: req.headers.filter((_, i) => i !== index), isDirty: true });

  const updateSyncUrlFromQueryParams = (nextQueryParams: Array<{ key: string; value: string; enabled: boolean }>) => {
    if (!syncQueryParams) {
      updateReq({ queryParams: nextQueryParams, isDirty: true });
      return;
    }

    const nextUrl = buildUrlFromQueryParams(req.url, nextQueryParams);
    if (!nextUrl) {
      setQueryMatchError('Unable to parse URL. Enter a valid URL and try again.');
      updateReq({ queryParams: nextQueryParams, isDirty: true });
      return;
    }

    setQueryMatchError(null);
    updateReq({ queryParams: nextQueryParams, url: nextUrl, isDirty: true });
  };

  const addQueryParam = () => {
    updateSyncUrlFromQueryParams([...req.queryParams, { key: '', value: '', enabled: true }]);
  };
  const updateQueryParam = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = req.queryParams.map((p, i) => i === index ? { ...p, [field]: value } : p);
    updateSyncUrlFromQueryParams(newParams);
  };
  const toggleQueryParamEnabled = (index: number) => {
    const newP = req.queryParams.map((p, i) => i === index ? { ...p, enabled: !p.enabled } : p);
    updateSyncUrlFromQueryParams(newP);
  };
  const removeQueryParam = (index: number) => updateSyncUrlFromQueryParams(req.queryParams.filter((_, i) => i !== index));
  const setAuth = (a: AuthState) => updateReq({ auth: a, isDirty: true });
  const setBodyRaw = (raw: string) => updateReq({ body: { ...req.body, raw }, isDirty: true });
  const markDirty = (dirty = true) => updateReq({ isDirty: dirty });

  // Response state destructuring
  const isSending = res.isSending;
  const responseData = res.responseData;
  const requestError = res.requestError;
  const sentUrl = res.sentUrl;
  const verboseLogs = res.verboseLogs;
  const requestBodyLanguage = res.requestBodyLanguage;
  const setRequestBodyLanguage = (lang: 'json' | 'html' | 'xml') => updateRes({ requestBodyLanguage: lang });

  const unresolvedVars = unresolvedIn(url);

  useEffect(() => {
    if (!syncQueryParams) {
      return;
    }

    const result = extractQueryParamsFromUrl(url);
    if (!result.ok) {
      setQueryMatchError('Unable to parse URL. Enter a valid URL and try again.');
      return;
    }

    setQueryMatchError(null);
    if (!areQueryParamsEqual(queryParams, result.params)) {
      updateReq({ queryParams: result.params, isDirty: true });
    }
  }, [syncQueryParams, url, queryParams, updateReq]);

  const appendLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const { activeTabId, appendResponseLog } = useTabStore.getState();
    appendResponseLog(activeTabId, `[${timestamp}] ${message}`);
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
      updateRes({ requestError: 'Please enter a URL first.', responseData: null });
      appendLog('Validation failed: URL is empty.');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    appendLog(`Normalized URL: ${normalizedUrl}`);

    const sendUrl = applyEnv(normalizedUrl);
    const sendUrlBase = stripQueryFromUrl(sendUrl);
    const sendUrlForRequest = syncQueryParams ? sendUrlBase : sendUrl;
    if (syncQueryParams && !parseUrlWithFallback(sendUrl) && sendUrl.includes('?')) {
      appendLog('Sync Query Parameters: using string-based query stripping fallback for an unparseable URL.');
    }
    const sendHeaders = headers.map((h) => ({ ...h, value: applyEnv(h.value) }));
    const sendQueryParams = queryParams.map((q) => ({ ...q, value: applyEnv(q.value) }));
    const sendBody = { ...body, raw: applyEnv(body.raw) };
    const requestedUrlForDisplay = buildRequestedUrlForDisplay(sendUrlForRequest, sendQueryParams, auth);

    updateRes({ isSending: true, requestError: null, responseData: null, sentUrl: requestedUrlForDisplay });

    const requestSnapshot = {
      id: crypto.randomUUID(),
      collection_id: null,
      folder_id: null,
      name: 'Untitled Request',
      method,
      url: sendUrlForRequest,
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
            url: sendUrlForRequest,
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

      updateRes({ responseData: response });

      const entry = await persistHistoryEntry({
        method,
        url: sendUrlForRequest,
        statusCode: response.status,
        responseTimeMs: Number(response.responseTimeMs),
        requestSnapshot,
      });
      historyStore.addEntry(entry);
      appendLog('History persisted for successful response.');
    } catch (error) {
      const reason = extractErrorReason(error);
      const message = `Request failed: ${reason}`;
      updateRes({ requestError: message });
      appendLog(`Send failed: ${reason}`);

      try {
        const errorEntry = await persistHistoryEntry({
          method,
          url: sendUrlForRequest,
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
      updateRes({ isSending: false });
      appendLog('Send flow completed.');
    }
  };

  const resolvedRequest: ResolvedRequest = {
    method,
    url: applyEnv(url.trim() ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`) : url.trim()),
    headers: headers.map((h) => ({ ...h, value: applyEnv(h.value) })),
    queryParams: queryParams.map((q) => ({ ...q, value: applyEnv(q.value) })),
    body: { ...body, raw: applyEnv(body.raw) },
    auth,
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendRequest}
                disabled={isSending}
                className="flex items-center gap-1.5 h-9 rounded-md border border-green-600 bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 hover:border-green-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70 transition-colors"
              >
                <Send size={14} />
                {isSending ? 'Sending...' : 'Send'}
              </button>
              <span className="w-px self-stretch bg-app-subtle opacity-50" aria-hidden="true" />
              <button
                type="button"
                onClick={() => setSaveDialogOpen(true)}
                className="border-app-subtle text-app-secondary h-9 rounded-md border px-3 flex items-center cursor-pointer"
                title="Save"
              >
                <Save size={15} />
              </button>
              <CopyAsButton resolvedRequest={resolvedRequest} />
            </div>
          </div>
        </div>

        <details
          open
          onToggle={(event) => setRequestDetailsOpen((event.currentTarget as HTMLDetailsElement).open)}
          className="border-app-subtle min-h-0 rounded-md border p-2 open:flex open:min-h-[18rem] open:flex-col"
          data-testid="request-details-accordion"
        >
          <summary className="text-app-secondary cursor-pointer text-sm font-medium">Request Details</summary>
          {requestDetailsOpen ? (
            <div className="mt-3 flex min-h-0 flex-1 flex-col space-y-3">
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
                toolbarRightAction={(
                  <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={syncQueryParams}
                      onChange={(event) => {
                        const nextChecked = event.target.checked;
                        setSyncQueryParams(nextChecked);

                        if (!nextChecked) {
                          setQueryMatchError(null);
                          return;
                        }

                        const result = extractQueryParamsFromUrl(req.url);
                        if (!result.ok) {
                          setQueryMatchError('Unable to parse URL. Enter a valid URL and try again.');
                          return;
                        }

                        setQueryMatchError(null);
                        if (!areQueryParamsEqual(queryParams, result.params)) {
                          updateReq({ queryParams: result.params, isDirty: true });
                        }
                      }}
                      aria-label="Sync Query Parameters"
                    />
                    Sync Query Parameters
                  </label>
                )}
                toolbarInlineMessage={queryMatchError}
              />
            ) : null}

            {activeTab === 'body' ? (
              <div className="flex min-h-0 flex-1 flex-col space-y-2">
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
                  height="100%"
                  onChange={setBodyRaw}
                />
              </div>
            ) : null}

            {activeTab === 'auth' ? (
              <AuthPanel auth={auth} onAuthChange={setAuth} />
            ) : null}
            </div>
          ) : null}
        </details>

        <section
          className="border-app-subtle flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border p-2"
          data-testid="response-panel"
        >
          <p className="text-app-secondary text-sm font-medium">Response</p>
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            {responseData || requestError || verboseLogs.length > 0 ? (
              <ResponseViewer
                response={responseData}
                error={requestError}
                logs={verboseLogs}
                onClearLogs={() => updateRes({ verboseLogs: [] })}
                requestedUrl={sentUrl ?? undefined}
              />
            ) : (
              <p className="text-app-muted text-sm">Send a request to see response details.</p>
            )}
          </div>
        </section>
      </div>

      <SaveRequestDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleDialogSave}
      />
    </main>
  );
}
