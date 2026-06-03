import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import type { ResponseData } from "@/components/ResponseViewer/ResponseViewer";
import {
  extractErrorReason,
  stripQueryFromUrl,
  parseUrlWithFallback,
  buildRequestedUrlForDisplay,
} from "@/lib/urlUtils";
import { interpolateRequestFields } from "@/lib/interpolateRequest";
import { interpolate } from "@/lib/interpolate";
import { usePreRequestScript, type ScriptError } from "@/hooks/usePreRequestScript";
import { usePostResponseScript } from "@/hooks/usePostResponseScript";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { useHistoryPersistence } from "@/hooks/useHistoryPersistence";
import type { AuthState, HttpMethod } from "@/stores/requestStore";
import { useTabStore, createDefaultScriptDebugState, type ScriptDebugState } from "@/stores/tabStore";
import { useDebugStore } from "@/stores/debugStore";
import { useScriptTemplateStore } from "@/stores/scriptTemplateStore";
import { useCollectionStore } from "@/stores/collectionStore";

function emitDebug(level: 'info' | 'warn' | 'error', message: string): void {
  useDebugStore.getState().addInternalEvent({
    id: `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level,
    source: 'fetch',
    message,
  });
}

interface UseSendRequestParams {
  url: string;
  method: HttpMethod;
  headers: Array<{ key: string; value: string; enabled: boolean }>;
  queryParams: Array<{ key: string; value: string; enabled: boolean }>;
  body: { mode: string; raw: string };
  auth: AuthState;
  syncQueryParams: boolean;
  applyEnv: (s: string) => string;
  timeout: number;
  sslVerify: boolean;
  activeTabId: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  updateRes: (patch: Record<string, unknown>) => void;
  setRequestDetailsOpen: (open: boolean) => void;
  preRequestScript: string;
  preRequestScriptEnabled: boolean;
  scriptKeepOpen: boolean;
  preRequestChainId?: string | null;
  preRequestTemplateId?: string | null;
  preRequestMode?: 'none' | 'javascript' | 'chain';
  postResponseScript?: string;
  postResponseScriptEnabled?: boolean;
}

function invokeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(
      () => reject(new Error(`Timed out after ${timeoutMs}ms waiting for Rust response`)),
      timeoutMs,
    );
    promise
      .then((value) => { clearTimeout(timeoutHandle); resolve(value); })
      .catch((error) => { clearTimeout(timeoutHandle); reject(error); });
  });
}

export function useSendRequest(params: UseSendRequestParams): {
  handleSendRequest: () => Promise<void>;
} {
  const { url, method, headers, queryParams, body, auth, syncQueryParams,
    applyEnv, timeout, sslVerify, activeTabId, abortControllerRef,
    updateRes, setRequestDetailsOpen, preRequestScript, preRequestScriptEnabled,
    scriptKeepOpen, preRequestTemplateId,
    postResponseScript, postResponseScriptEnabled } = params;

  const { executePreScript } = usePreRequestScript();
  const { executePostScript } = usePostResponseScript();
  const { persistToHistory } = useHistoryPersistence();

  const appendLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const { activeTabId: tabId, appendResponseLog } = useTabStore.getState();
    appendResponseLog(tabId, `[${timestamp}] ${message}`);
  }, []);

  const handleSendRequest = useCallback(async () => {
    const rawUrl = url.trim();
    emitDebug('info', `${method} ${rawUrl || '<empty>'} — send initiated`);
    appendLog(`Send clicked with method=${method}, rawUrl=${rawUrl || "<empty>"}`);

    if (!rawUrl) {
      updateRes({ requestError: "Please enter a URL first.", responseData: null });
      emitDebug('warn', 'Send aborted — URL is empty');
      appendLog("Validation failed: URL is empty.");
      return;
    }

    // Interpolate environment variables
    let { url: sendUrl, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody, auth: sendAuth } =
      interpolateRequestFields(applyEnv, rawUrl, headers, queryParams, body, auth);

    emitDebug('info', `Resolved URL: ${sendUrl}`);
    appendLog(`Resolved URL: ${sendUrl}`);
    const sendUrlBase = stripQueryFromUrl(sendUrl);
    let sendUrlForRequest = syncQueryParams ? sendUrlBase : sendUrl;
    if (syncQueryParams && !parseUrlWithFallback(sendUrl) && sendUrl.includes("?")) {
      appendLog("Sync Query Parameters: using string-based query stripping fallback for an unparseable URL.");
    }

    // Pre-request chains were retired (Story rework): the chooser to create/edit one
    // was removed and migration 018 clears every binding, so no chain executes here.

    // Compose the pre-request execution, in run order:
    //   1. collection-wide "global" script (applies to every request in the collection)
    //   2. a linked script template (if any)
    //   3. this request's own inline script
    // Each part is gated independently so the global script still runs even when the
    // request has no script of its own (or uses chain mode).
    const collStore = useCollectionStore.getState();
    // Resolve the collection from the request bound to the TAB being sent, not the
    // global activeRequestId (last tree selection) — those diverge with multiple
    // open tabs, which would prepend the wrong collection's global script.
    const sentSavedRequestId =
      useTabStore.getState().tabs.find((tb) => tb.id === activeTabId)?.requestState.savedRequestId ?? null;
    const activeReq = sentSavedRequestId
      ? collStore.requests.find((r) => r.id === sentSavedRequestId)
      : null;
    const collection = activeReq?.collection_id
      ? collStore.collections.find((c) => c.id === activeReq.collection_id)
      : null;
    const globalScript = collection?.pre_request_script_enabled && collection.pre_request_script?.trim()
      ? collection.pre_request_script
      : '';

    let templateCode = '';
    if (preRequestTemplateId) {
      const tplStore = useScriptTemplateStore.getState();
      if (!tplStore.isLoaded) await tplStore.load();
      templateCode = useScriptTemplateStore.getState().templates.find((t) => t.id === preRequestTemplateId)?.code ?? '';
    }

    const ownScript = preRequestScriptEnabled ? preRequestScript : '';

    // Run one pre-request-style stage: execute, persist env mutations, re-interpolate, and
    // apply the resulting field mutations to the outgoing request. Returns false on error.
    const runPreStage = async (
      scriptCode: string,
      label: string,
      updateDebug: (patch: Partial<ScriptDebugState>) => void,
    ): Promise<boolean> => {
      emitDebug('info', `Executing ${label} script`);
      appendLog(`Executing ${label} script...`);
      const inputSnap = { url: sendUrlForRequest, method, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody.raw };
      updateDebug({ ...createDefaultScriptDebugState(), status: 'running', startTime: Date.now(), inputSnapshot: inputSnap });
      try {
        const result = await executePreScript(scriptCode, {
          url: sendUrlForRequest, method, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody.raw,
        });
        // Re-interpolate with fresh env vars (fb.env.set mutations are persisted before we get here)
        const freshEnv = useEnvironmentStore.getState();
        const activeEnv = freshEnv.environments.find((e) => e.id === freshEnv.activeEnvironmentId);
        const freshVars = activeEnv?.variables ?? [];
        const reInterpolate = (s: string) => interpolate(s, freshVars);

        sendUrlForRequest = reInterpolate(result.url);
        sendHeaders = result.headers.map((h) => ({ ...h, value: reInterpolate(h.value) }));
        sendQueryParams = result.queryParams.map((q) => ({ ...q, value: reInterpolate(q.value) }));
        sendBody = { ...sendBody, raw: reInterpolate(result.body) };

        const outputSnap = { url: result.url, headers: result.headers, queryParams: result.queryParams, body: result.body };
        updateDebug({ status: 'completed', endTime: Date.now(), consoleLogs: result.consoleLogs, httpLogs: result.httpLogs, outputSnapshot: outputSnap });
        emitDebug('info', `${label} script completed`);
        appendLog(`${label} script completed successfully.`);
        return true;
      } catch (scriptError) {
        const err = scriptError as ScriptError & { consoleLogs?: unknown[]; httpLogs?: unknown[] };
        const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
        const message = `${label} script error${lineInfo}: ${err.message}`;
        updateDebug({
          status: 'error', endTime: Date.now(), error: { message: err.message, lineNumber: err.lineNumber, stack: err.stack },
          consoleLogs: (err.consoleLogs ?? []) as never[], httpLogs: (err.httpLogs ?? []) as never[],
        });
        emitDebug('error', message);
        updateRes({ requestError: message, responseData: null, isSending: false });
        appendLog(`Script error: ${message}`);
        return false;
      }
    };

    const { updateTabGlobalDebugState, updateTabScriptDebugState } = useTabStore.getState();

    // 1. Collection-wide "global" script runs first — its own stage (chain mode aside).
    if (globalScript.trim()) {
      if (!await runPreStage(globalScript, 'Collection (global)', (patch) => updateTabGlobalDebugState(activeTabId, patch))) return;
    }

    // 2. The request's own pre-request (linked template + inline script) — the pre-request stage.
    const preStageScript = [templateCode, ownScript].filter((s) => s.trim()).join('\n\n');
    if (preStageScript.trim()) {
      if (!await runPreStage(preStageScript, 'Pre-request', (patch) => updateTabScriptDebugState(activeTabId, patch))) return;
    }

    const requestedUrlForDisplay = buildRequestedUrlForDisplay(sendUrlForRequest, sendQueryParams, sendAuth as AuthState);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateRes({
      isSending: true, requestError: null, responseData: null,
      wasCancelled: false, wasTimedOut: false, timedOutAfterSec: null, sentUrl: requestedUrlForDisplay,
    });
    if (scriptKeepOpen) {
      useTabStore.getState().updateTabRequestState(activeTabId, { activeTab: 'scripts' });
    } else {
      setRequestDetailsOpen(false);
    }

    const requestSnapshot = {
      id: crypto.randomUUID(), collection_id: null, folder_id: null, name: "Untitled Request",
      method, url: sendUrlForRequest, headers: sendHeaders, query_params: sendQueryParams,
      body_type: sendBody.raw.trim() ? "raw" : "none", body_content: sendBody.raw,
      auth_type: auth.type, auth_config: {}, pre_request_script: preRequestScript,
      pre_request_script_enabled: preRequestScriptEnabled, pre_request_chain_id: null,
      pre_request_template_id: preRequestTemplateId ?? null, sort_order: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    } as const;

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => reject(new DOMException("AbortError", "AbortError")));
    });

    try {
      emitDebug('info', `${method} ${sendUrlForRequest} — sending (timeout: ${timeout}ms, auth: ${auth.type})`);
      appendLog("Invoking Rust command: send_request");
      const invokePromise = invoke<ResponseData>("send_request", {
        request: { method, url: sendUrlForRequest, headers: sendHeaders, queryParams: sendQueryParams,
          body: sendBody, auth: sendAuth, timeoutMs: timeout, sslVerify, requestId: activeTabId },
      });
      const timedInvoke = timeout > 0 ? invokeWithTimeout(invokePromise, timeout + 5000) : invokePromise;
      const response = await Promise.race([timedInvoke, abortPromise]);

      emitDebug('info', `${method} ${sendUrlForRequest} — ${response.status} in ${response.responseTimeMs}ms (${response.responseSizeBytes} bytes)`);
      appendLog(`Rust response received: status=${response.status}, time=${response.responseTimeMs}ms, size=${response.responseSizeBytes}bytes`);
      updateRes({ responseData: response });
      await persistToHistory(method, sendUrlForRequest, response.status, Number(response.responseTimeMs), requestSnapshot);
      appendLog("History persisted for successful response.");

      // Post-response / test script (Story 20.8) — runs after the response is shown.
      if (postResponseScript?.trim() && postResponseScriptEnabled) {
        emitDebug('info', 'Executing post-response script');
        appendLog('Executing post-response script...');
        const { updateTabPostResponseDebugState } = useTabStore.getState();
        const headersRecord: Record<string, string> = {};
        for (const h of response.headers ?? []) headersRecord[h.key] = h.value;
        updateTabPostResponseDebugState(activeTabId, {
          ...createDefaultScriptDebugState(), stage: 'post-response', status: 'running', startTime: Date.now(),
        });
        try {
          const postResult = await executePostScript(postResponseScript, {
            status: response.status,
            headers: headersRecord,
            body: response.body,
            time: Number(response.responseTimeMs),
          });
          updateTabPostResponseDebugState(activeTabId, {
            stage: 'post-response', status: 'completed', endTime: Date.now(),
            consoleLogs: postResult.consoleLogs, testResults: postResult.testResults,
          });
          const failed = postResult.testResults.filter((t) => !t.passed).length;
          emitDebug(failed > 0 ? 'warn' : 'info', `Post-response script completed (${postResult.testResults.length} test(s), ${failed} failed)`);
          appendLog(`Post-response script completed: ${postResult.testResults.length} test(s), ${failed} failed.`);
        } catch (postErr) {
          const err = postErr as ScriptError & { consoleLogs?: unknown[] };
          const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
          const message = `Post-response script error${lineInfo}: ${err.message}`;
          updateTabPostResponseDebugState(activeTabId, {
            stage: 'post-response', status: 'error', endTime: Date.now(),
            error: { message: err.message, lineNumber: err.lineNumber, stack: err.stack },
            consoleLogs: (err.consoleLogs ?? []) as never[],
          });
          emitDebug('error', message);
          appendLog(message);
          // Do NOT clobber the displayed response — the error only surfaces in the debug state.
        }
      }
    } catch (error) {
      if ((error instanceof DOMException && error.name === "AbortError") || extractErrorReason(error) === "__CANCELLED__") {
        emitDebug('warn', `${method} ${sendUrlForRequest} — cancelled by user`);
        updateRes({ isSending: false, wasCancelled: true, responseData: null, requestError: null });
        appendLog("Request cancelled by user.");
        return;
      }

      const reason = extractErrorReason(error);
      if (reason === "__TIMEOUT__") {
        const sec = timeout > 0 ? timeout / 1000 : 0;
        emitDebug('warn', `${method} ${sendUrlForRequest} — timed out after ${sec}s`);
        updateRes({ isSending: false, wasTimedOut: true, timedOutAfterSec: sec, responseData: null, requestError: null });
        appendLog(`Request timed out after ${sec}s.`);
        return;
      }

      emitDebug('error', `${method} ${sendUrlForRequest} — ${reason}`);
      updateRes({ requestError: `Request failed: ${reason}` });
      appendLog(`Send failed: ${reason}`);
      try {
        await persistToHistory(method, sendUrlForRequest, 0, 0, requestSnapshot);
        appendLog("History persisted for failed response.");
      } catch { appendLog("History persistence failed after request failure."); }
    } finally {
      abortControllerRef.current = null;
      updateRes({ isSending: false });
      appendLog("Send flow completed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, method, headers, queryParams, body, auth, syncQueryParams, applyEnv,
    timeout, sslVerify, activeTabId, preRequestScript, preRequestScriptEnabled,
    scriptKeepOpen, preRequestTemplateId,
    postResponseScript, postResponseScriptEnabled]);

  return { handleSendRequest };
}
