import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import type { HttpMethod, RequestTab } from '@/stores/requestStore';
import { useRequestStore } from '@/stores/requestStore';
import { useState } from 'react';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const REQUEST_TABS: Array<{ id: RequestTab; label: string }> = [
  { id: 'headers', label: 'Headers' },
  { id: 'query', label: 'Query Params' },
  { id: 'body', label: 'Body' },
  { id: 'auth', label: 'Auth' },
];

export function MainPanel() {
  const [isSending, setIsSending] = useState(false);
  const [requestResult, setRequestResult] = useState<string | null>(null);

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
    setBodyRaw,
  } = useRequestStore();

  const handleSendRequest = async () => {
    const rawUrl = url.trim();

    if (!rawUrl) {
      setRequestResult('Please enter a URL first.');
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;

    setIsSending(true);
    setRequestResult(null);

    try {
      try {
        const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
        const response = await tauriFetch(normalizedUrl, { method });
        setRequestResult(`Request complete: ${response.status} ${response.statusText}`);
        return;
      } catch {
        // Fallback to browser fetch (used in tests/web mode).
      }

      const browserResponse = await fetch(normalizedUrl, { method });
      setRequestResult(`Request complete: ${browserResponse.status} ${browserResponse.statusText}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown error';
      setRequestResult(
        `Request failed: ${reason}. Verify URL/protocol and API reachability. If this is a public API, try full https URL (for example: https://httpbin.org/get).`,
      );
    } finally {
      setIsSending(false);
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

        {requestResult ? <p className="text-app-muted text-sm">{requestResult}</p> : null}

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
            <label htmlFor="raw-body" className="text-app-secondary block text-sm font-medium">
              Raw Body
            </label>
            <textarea
              id="raw-body"
              aria-label="Raw Body"
              value={body.raw}
              onChange={(event) => setBodyRaw(event.target.value)}
              rows={8}
              className="border-app-subtle text-app-primary w-full rounded-md border p-3 font-mono text-sm"
            />
          </div>
        ) : null}

        {activeTab === 'auth' ? <p className="text-app-muted text-sm">Auth: None</p> : null}
      </div>
    </main>
  );
}
