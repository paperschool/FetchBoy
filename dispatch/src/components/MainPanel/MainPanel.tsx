import { KeyValueRows } from '@/components/RequestBuilder/KeyValueRows';
import type { HttpMethod, RequestTab } from '@/stores/requestStore';
import { useRequestStore } from '@/stores/requestStore';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const REQUEST_TABS: Array<{ id: RequestTab; label: string }> = [
  { id: 'headers', label: 'Headers' },
  { id: 'query', label: 'Query Params' },
  { id: 'body', label: 'Body' },
  { id: 'auth', label: 'Auth' },
];

export function MainPanel() {
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

  return (
    <main
      data-testid="main-panel"
      className="overflow-auto bg-white p-4 dark:bg-gray-950"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">Request Builder</p>

        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <div>
            <label htmlFor="http-method" className="mb-1 block text-xs font-medium text-gray-700">
              HTTP Method
            </label>
            <select
              id="http-method"
              aria-label="HTTP Method"
              value={method}
              onChange={(event) => setMethod(event.target.value as HttpMethod)}
              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
            >
              {HTTP_METHODS.map((httpMethod) => (
                <option key={httpMethod} value={httpMethod}>
                  {httpMethod}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="request-url" className="mb-1 block text-xs font-medium text-gray-700">
              Request URL
            </label>
            <input
              id="request-url"
              aria-label="Request URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://api.example.com"
              className="h-9 w-full rounded-md border border-gray-300 px-3 text-sm"
            />
          </div>
        </div>

        <div className="border-b border-gray-200">
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
                      ? 'border border-b-0 border-gray-300 bg-white font-medium text-gray-900'
                      : 'text-gray-600 hover:text-gray-900'
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
            <label htmlFor="raw-body" className="block text-sm font-medium text-gray-700">
              Raw Body
            </label>
            <textarea
              id="raw-body"
              aria-label="Raw Body"
              value={body.raw}
              onChange={(event) => setBodyRaw(event.target.value)}
              rows={8}
              className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
            />
          </div>
        ) : null}

        {activeTab === 'auth' ? <p className="text-sm text-gray-600">Auth: None</p> : null}
      </div>
    </main>
  );
}
