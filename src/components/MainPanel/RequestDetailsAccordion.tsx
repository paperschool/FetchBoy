import { MonacoEditorField } from "@/components/Editor/MonacoEditorField";
import { KeyValueRows } from "@/components/RequestBuilder/KeyValueRows";
import { AuthPanel } from "@/components/AuthPanel/AuthPanel";
import { TimeoutInput } from "@/components/RequestBuilder/TimeoutInput";
import { extractQueryParamsFromUrl } from "@/lib/extractQueryParamsFromUrl";
import { areQueryParamsEqual, buildUrlFromQueryParams } from "@/lib/urlUtils";
import type { AuthState, HttpMethod, RequestTab } from "@/stores/requestStore";
import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";

const HTTP_METHODS: HttpMethod[] = [
  "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS",
];
const REQUEST_TABS: Array<{ id: RequestTab; label: string }> = [
  { id: "headers", label: "Headers" },
  { id: "query", label: "Query Params" },
  { id: "body", label: "Body" },
  { id: "auth", label: "Auth" },
  { id: "options", label: "Options" },
];

export { HTTP_METHODS };

interface RequestDetailsAccordionProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  activeTab: RequestTab;
  setActiveTab: (t: RequestTab) => void;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  body: { mode: string; raw: string };
  auth: AuthState;
  timeout: number;
  isSending: boolean;
  requestBodyLanguage: "json" | "html" | "xml";
  editorFontSize: number;
  url: string;
  syncQueryParams: boolean;
  setSyncQueryParams: Dispatch<SetStateAction<boolean>>;
  updateReq: (patch: Record<string, unknown>) => void;
  setRequestBodyLanguage: (lang: "json" | "html" | "xml") => void;
  setRequestTimeout: (ms: number) => void;
  setAuth: (a: AuthState) => void;
  setBodyRaw: (raw: string) => void;
  banner?: React.ReactNode;
  activeVariables?: import('@/lib/db').KeyValuePair[];
}

export function RequestDetailsAccordion(props: RequestDetailsAccordionProps): React.ReactElement {
  const {
    open,
    onToggle,
    activeTab,
    setActiveTab,
    headers,
    queryParams,
    body,
    auth,
    timeout,
    isSending,
    requestBodyLanguage,
    editorFontSize,
    url,
    syncQueryParams,
    setSyncQueryParams,
    updateReq,
    setRequestBodyLanguage,
    setRequestTimeout,
    setAuth,
    setBodyRaw,
    banner,
    activeVariables,
  } = props;

  const [queryMatchError, setQueryMatchError] = useState<string | null>(null);

  // Header actions
  const addHeader = (): void =>
    updateReq({
      headers: [...headers, { key: "", value: "", enabled: true }],
      isDirty: true,
    });
  const updateHeader = (index: number, field: "key" | "value", value: string): void => {
    const newHeaders = headers.map((h, i) =>
      i === index ? { ...h, [field]: value } : h,
    );
    updateReq({ headers: newHeaders, isDirty: true });
  };
  const toggleHeaderEnabled = (index: number): void => {
    const newH = headers.map((h, i) =>
      i === index ? { ...h, enabled: !h.enabled } : h,
    );
    updateReq({ headers: newH, isDirty: true });
  };
  const removeHeader = (index: number): void =>
    updateReq({
      headers: headers.filter((_, i) => i !== index),
      isDirty: true,
    });

  // Query param actions with URL sync
  const updateSyncUrlFromQueryParams = (
    nextQueryParams: Array<{ key: string; value: string; enabled: boolean }>,
  ): void => {
    if (!syncQueryParams) {
      updateReq({ queryParams: nextQueryParams, isDirty: true });
      return;
    }

    const nextUrl = buildUrlFromQueryParams(url, nextQueryParams);
    if (!nextUrl) {
      setQueryMatchError("Unable to parse URL. Enter a valid URL and try again.");
      updateReq({ queryParams: nextQueryParams, isDirty: true });
      return;
    }

    setQueryMatchError(null);
    updateReq({ queryParams: nextQueryParams, url: nextUrl, isDirty: true });
  };

  const addQueryParam = (): void => {
    updateSyncUrlFromQueryParams([
      ...queryParams,
      { key: "", value: "", enabled: true },
    ]);
  };
  const updateQueryParam = (index: number, field: "key" | "value", value: string): void => {
    const newParams = queryParams.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    updateSyncUrlFromQueryParams(newParams);
  };
  const toggleQueryParamEnabled = (index: number): void => {
    const newP = queryParams.map((p, i) =>
      i === index ? { ...p, enabled: !p.enabled } : p,
    );
    updateSyncUrlFromQueryParams(newP);
  };
  const removeQueryParam = (index: number): void =>
    updateSyncUrlFromQueryParams(queryParams.filter((_, i) => i !== index));

  return (
    <details
      open={open}
      onToggle={(event) =>
        onToggle((event.currentTarget as HTMLDetailsElement).open)
      }
      className="border-app-subtle min-h-0 rounded-md border p-2 open:flex open:min-h-[18rem] open:flex-col"
      data-testid="request-details-accordion"
      data-tour="request-details"
    >
      <summary className="text-app-secondary cursor-pointer text-sm font-medium flex items-center gap-3">
        <span>Request Details</span>
        {banner}
      </summary>
      {open ? (
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
                    className={`rounded-t-md px-3 py-2 text-sm cursor-pointer ${
                      isActive
                        ? "border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium"
                        : "text-app-muted hover:text-app-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "headers" ? (
            <KeyValueRows
              sectionName="headers"
              rows={headers}
              addLabel="Add Header"
              onAdd={addHeader}
              onUpdate={updateHeader}
              onToggleEnabled={toggleHeaderEnabled}
              onRemove={removeHeader}
              activeVariables={activeVariables}
            />
          ) : null}

          {activeTab === "query" ? (
            <KeyValueRows
              sectionName="query"
              rows={queryParams}
              addLabel="Add Query Param"
              onAdd={addQueryParam}
              onUpdate={updateQueryParam}
              onToggleEnabled={toggleQueryParamEnabled}
              onRemove={removeQueryParam}
              activeVariables={activeVariables}
              toolbarRightAction={
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

                      const result = extractQueryParamsFromUrl(url);
                      if (!result.ok) {
                        setQueryMatchError(
                          "Unable to parse URL. Enter a valid URL and try again.",
                        );
                        return;
                      }

                      setQueryMatchError(null);
                      if (!areQueryParamsEqual(queryParams, result.params)) {
                        updateReq({
                          queryParams: result.params,
                          isDirty: true,
                        });
                      }
                    }}
                    aria-label="Sync Query Parameters"
                  />
                  Sync Query Parameters
                </label>
              }
              toolbarInlineMessage={queryMatchError}
            />
          ) : null}

          {activeTab === "body" ? (
            <div className="flex min-h-0 flex-1 flex-col space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-app-secondary block text-sm font-medium">
                  Request Body
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="request-body-language"
                    aria-label="Request Body Language"
                    value={requestBodyLanguage}
                    onChange={(event) =>
                      setRequestBodyLanguage(
                        event.target.value as "json" | "html" | "xml",
                      )
                    }
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

          {activeTab === "auth" ? (
            <AuthPanel auth={auth} onAuthChange={setAuth} />
          ) : null}

          {activeTab === "options" ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <label className="text-app-secondary text-sm font-medium w-32 shrink-0">
                  Timeout
                </label>
                <TimeoutInput
                  value={timeout}
                  onChange={setRequestTimeout}
                  disabled={isSending}
                />
                <p className="text-app-muted text-xs">
                  0 = no timeout. Overrides the global default for this tab.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
