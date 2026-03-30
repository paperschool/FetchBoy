import { Loader2, Plus, Save, Send, X } from "lucide-react";
import { CopyAsButton } from "./CopyAsButton";
import { HighlightedUrlInput } from "./HighlightedUrlInput";
import { RequestDetailsAccordion, HTTP_METHODS } from "./RequestDetailsAccordion";
import type { ResolvedRequest } from "@/lib/generateSnippet";
import {
  ResponseViewer,
} from "@/components/ResponseViewer/ResponseViewer";
import { SaveRequestDialog } from "@/components/SaveRequestDialog/SaveRequestDialog";
import { ProgressBar } from "@/components/ProgressBar/ProgressBar";
import { createFullSavedRequest, updateSavedRequest } from "@/lib/collections";
import { authStateToConfig, areQueryParamsEqual } from "@/lib/urlUtils";
import { extractQueryParamsFromUrl } from "@/lib/extractQueryParamsFromUrl";
import type { HttpMethod } from "@/stores/requestStore";
import { useTabStore } from "@/stores/tabStore";
import {
  useActiveRequestState,
  useActiveResponseState,
} from "@/hooks/useActiveTabState";
import { useCollectionStore } from "@/stores/collectionStore";
import { useUiSettingsStore } from "@/stores/uiSettingsStore";
import { useEnvironment } from "@/hooks/useEnvironment";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { useSendRequest } from "@/hooks/useSendRequest";
import { useProgressBar } from "@/hooks/useProgressBar";
import { useCallback, useEffect, useRef, useState } from "react";
import useSendRequestKeyboardShortcut from "@/hooks/useSendRequestKeyboardShortcut";

export function MainPanel(): React.ReactElement {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [requestDetailsOpen, setRequestDetailsOpen] = useState(true);
  const [syncQueryParams, setSyncQueryParams] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);
  const sslVerify = useUiSettingsStore((s) => s.sslVerify);

  const activeTabId = useTabStore((s) => s.activeTabId);
  const openedFromIntercept = useTabStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.openedFromIntercept);
  const clearOpenedFromIntercept = useTabStore((s) => s.clearOpenedFromIntercept);
  const [bannerTabId, setBannerTabId] = useState<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissBanner = useCallback((): void => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = null;
    setBannerTabId(null);
  }, []);

  useEffect(() => {
    if (!openedFromIntercept) return;
    clearOpenedFromIntercept(activeTabId);
    setBannerTabId(activeTabId);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(dismissBanner, 5000);
  }, [openedFromIntercept, activeTabId, clearOpenedFromIntercept, dismissBanner]);

  useEffect(() => () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); }, []);

  const collectionStore = useCollectionStore();
  const {
    interpolate: applyEnv,
    unresolvedIn,
    activeVariables,
  } = useEnvironment();

  const { state: req, update: updateReq } = useActiveRequestState();
  const { state: res, update: updateRes } = useActiveResponseState();

  const { method, url, headers, queryParams, body, auth, activeTab, timeout, preRequestScript, preRequestScriptEnabled } = req;
  const { isSending, responseData, requestError, sentUrl, verboseLogs, requestBodyLanguage, wasCancelled, wasTimedOut, timedOutAfterSec } = res;

  const setMethod = (m: HttpMethod): void => updateReq({ method: m, isDirty: true });
  const setUrl = (u: string): void => updateReq({ url: u, isDirty: true });
  const setAuth = (a: typeof auth): void => updateReq({ auth: a, isDirty: true });
  const setBodyRaw = (raw: string): void => updateReq({ body: { ...body, raw }, isDirty: true });
  const setRequestTimeout = (ms: number): void => updateReq({ timeout: ms });
  const setRequestBodyLanguage = (lang: "json" | "html" | "xml"): void => updateRes({ requestBodyLanguage: lang });
  const markDirty = (dirty = true): void => updateReq({ isDirty: dirty });

  const unresolvedVars = unresolvedIn(url);

  useEffect(() => {
    if (!syncQueryParams) return;
    const result = extractQueryParamsFromUrl(url);
    if (!result.ok) return;
    if (!areQueryParamsEqual(queryParams, result.params)) {
      updateReq({ queryParams: result.params, isDirty: true });
    }
  }, [syncQueryParams, url, queryParams, updateReq]);

  const { handleSendRequest } = useSendRequest({
    url, method, headers, queryParams, body, auth,
    syncQueryParams, applyEnv, timeout, sslVerify, activeTabId,
    abortControllerRef, updateRes, setRequestDetailsOpen,
    preRequestScript, preRequestScriptEnabled,
  });

  useSendRequestKeyboardShortcut(handleSendRequest);

  const { progressState, handleCancelRequest, handleProgressComplete } = useProgressBar({
    isSending, responseData, requestError, wasCancelled, wasTimedOut,
    activeTabId, abortControllerRef,
  });

  const resolvedRequest: ResolvedRequest = {
    method,
    url: applyEnv(
      url.trim()
        ? /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`
        : url.trim(),
    ),
    headers: headers.map((h) => ({ ...h, value: applyEnv(h.value) })),
    queryParams: queryParams.map((q) => ({ ...q, value: applyEnv(q.value) })),
    body: { ...body, raw: applyEnv(body.raw) },
    auth,
  };

  const handleDialogSave = async (
    saveName: string,
    collectionId: string,
    folderId: string | null,
  ): Promise<void> => {
    const existing = collectionStore.requests.find(
      (r) =>
        r.name === saveName &&
        r.collection_id === collectionId &&
        (r.folder_id ?? null) === folderId,
    );

    if (existing) {
      if (!window.confirm("A request with this name already exists. Overwrite?")) return;
      const payload = {
        name: saveName, method, url, headers, query_params: queryParams,
        body_type: body.mode, body_content: body.raw,
        auth_type: auth.type, auth_config: authStateToConfig(auth),
      };
      await updateSavedRequest(existing.id, payload);
      collectionStore.updateRequest(existing.id, payload);
      collectionStore.setActiveRequest(existing.id);
    } else {
      const saved = await createFullSavedRequest({
        collection_id: collectionId, folder_id: folderId, name: saveName,
        method, url, headers, query_params: queryParams,
        body_type: body.mode, body_content: body.raw,
        auth_type: auth.type, auth_config: authStateToConfig(auth),
        pre_request_script: '', pre_request_script_enabled: true,
        sort_order: 0,
      });
      collectionStore.addRequest(saved);
      collectionStore.setActiveRequest(saved.id);
    }

    markDirty(false);
    setSaveDialogOpen(false);
  };

  return (
    <>
      <ProgressBar
        isActive={progressState.isRequestInFlight}
        progress={progressState.requestProgress}
        onComplete={handleProgressComplete}
      />
      <main data-testid="main-panel" className="bg-app-main text-app-primary flex flex-col overflow-hidden p-4 h-full">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <p className="text-app-muted text-sm">Request Builder</p>

          <div className="grid grid-cols-[8rem_1fr_auto] items-start gap-3" data-tour="request-builder">
            <div>
              <label htmlFor="http-method" className="text-app-secondary mb-1 block text-xs font-medium">HTTP Method</label>
              <select id="http-method" aria-label="HTTP Method" value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className="select-flat border-app-subtle bg-app-main text-app-primary h-9 w-full rounded-md border pl-2 pr-7 text-sm">
                {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="request-url" className="text-app-secondary mb-1 block text-xs font-medium">Request URL</label>
              <HighlightedUrlInput id="request-url" value={url} onChange={setUrl} placeholder="https://api.example.com" variables={activeVariables} />
              {unresolvedVars.length > 0 && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-orange-400">
                  <span>⚠ Unresolved:</span>
                  {unresolvedVars.map((v) => (
                    <button key={v} type="button" onClick={() => useEnvironmentStore.getState().requestAddVariable(v)}
                      className="inline-flex items-center gap-0.5 rounded bg-orange-500/15 px-1.5 py-0.5 hover:bg-orange-500/25 cursor-pointer transition-colors"
                      title={`Add {{${v}}} to active environment`}>
                      {`{{${v}}}`}<Plus size={10} />
                    </button>
                  ))}
                </p>
              )}
            </div>
            <div>
              <p className="text-app-secondary mb-1 block text-xs font-medium">Controls</p>
              <div className="flex items-center gap-2" data-tour="request-controls">
                {isSending ? (
                  <button type="button" onClick={handleCancelRequest} className="flex items-center gap-1.5 h-9 rounded-md border border-amber-500 bg-amber-500 px-4 text-sm font-medium text-white hover:bg-amber-600 hover:border-amber-600 cursor-pointer transition-colors" aria-label="Cancel request">
                    <Loader2 size={14} className="animate-spin" /> Cancel
                  </button>
                ) : (
                  <button type="button" onClick={handleSendRequest} className="flex items-center gap-1.5 h-9 rounded-md border border-green-600 bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 hover:border-green-700 cursor-pointer transition-colors">
                    <Send size={14} /> Send
                  </button>
                )}
                <span className="w-px self-stretch bg-app-subtle opacity-50" aria-hidden="true" />
                <button type="button" onClick={() => setSaveDialogOpen(true)} className="border-app-subtle text-app-secondary h-9 rounded-md border px-3 flex items-center cursor-pointer" title="Save">
                  <Save size={15} />
                </button>
                <CopyAsButton resolvedRequest={resolvedRequest} />
              </div>
            </div>
          </div>

          <RequestDetailsAccordion
            open={requestDetailsOpen}
            onToggle={setRequestDetailsOpen}
            activeTab={activeTab}
            setActiveTab={(t) => updateReq({ activeTab: t })}
            headers={headers}
            queryParams={queryParams}
            body={body}
            auth={auth}
            timeout={timeout}
            isSending={isSending}
            requestBodyLanguage={requestBodyLanguage}
            editorFontSize={editorFontSize}
            url={url}
            syncQueryParams={syncQueryParams}
            setSyncQueryParams={setSyncQueryParams}
            updateReq={updateReq}
            setRequestBodyLanguage={setRequestBodyLanguage}
            setRequestTimeout={setRequestTimeout}
            setAuth={setAuth}
            setBodyRaw={setBodyRaw}
            preRequestScript={preRequestScript}
            preRequestScriptEnabled={preRequestScriptEnabled}
            onScriptChange={(script) => updateReq({ preRequestScript: script, isDirty: true })}
            onScriptEnabledChange={(enabled) => updateReq({ preRequestScriptEnabled: enabled, isDirty: true })}
            activeVariables={activeVariables}
            banner={bannerTabId === activeTabId ? (
              <span className="flex items-center gap-1.5 rounded bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400 font-normal animate-pulse" onClick={(e) => e.preventDefault()}>
                Headers and Query Parameters added below
                <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); dismissBanner(); }} className="cursor-pointer hover:text-blue-300" aria-label="Dismiss">
                  <X size={12} />
                </button>
              </span>
            ) : undefined}
          />

          <section className="border-app-subtle flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border p-2" data-testid="response-panel" data-tour="response-panel">
            <p className="text-app-secondary text-sm font-medium">Response</p>
            <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
              {responseData || requestError || verboseLogs.length > 0 || wasCancelled || wasTimedOut ? (
                <ResponseViewer response={responseData} error={requestError} logs={verboseLogs} wasCancelled={wasCancelled} wasTimedOut={wasTimedOut} timedOutAfterSec={timedOutAfterSec} onClearLogs={() => updateRes({ verboseLogs: [] })} requestedUrl={sentUrl ?? undefined} />
              ) : (
                <p className="text-app-muted text-sm">Send a request to see response details.</p>
              )}
            </div>
          </section>
        </div>

        <SaveRequestDialog open={saveDialogOpen} onClose={() => setSaveDialogOpen(false)} onSave={handleDialogSave} />
      </main>
    </>
  );
}
