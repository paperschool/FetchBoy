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
import { usePreRequestScript, type ScriptError } from "@/hooks/usePreRequestScript";
import { useHistoryPersistence } from "@/hooks/useHistoryPersistence";
import type { AuthState, HttpMethod } from "@/stores/requestStore";
import { useTabStore } from "@/stores/tabStore";
import { useDebugStore } from "@/stores/debugStore";

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
    updateRes, setRequestDetailsOpen, preRequestScript, preRequestScriptEnabled } = params;

  const { executePreScript } = usePreRequestScript();
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

    // Pre-request script execution
    if (preRequestScript.trim() && preRequestScriptEnabled) {
      emitDebug('info', 'Executing pre-request script');
      appendLog("Executing pre-request script...");
      try {
        const result = await executePreScript(preRequestScript, {
          url: sendUrlForRequest, method, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody.raw,
        });
        sendUrlForRequest = result.url;
        sendHeaders = result.headers;
        sendQueryParams = result.queryParams;
        sendBody = { ...sendBody, raw: result.body };
        emitDebug('info', 'Pre-request script completed');
        appendLog("Pre-request script completed successfully.");
      } catch (scriptError) {
        const err = scriptError as ScriptError;
        const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
        const message = `Pre-request script error${lineInfo}: ${err.message}`;
        emitDebug('error', message);
        updateRes({ requestError: message, responseData: null, isSending: false });
        appendLog(`Script error: ${message}`);
        return;
      }
    }

    const requestedUrlForDisplay = buildRequestedUrlForDisplay(sendUrlForRequest, sendQueryParams, sendAuth as AuthState);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateRes({
      isSending: true, requestError: null, responseData: null,
      wasCancelled: false, wasTimedOut: false, timedOutAfterSec: null, sentUrl: requestedUrlForDisplay,
    });
    setRequestDetailsOpen(false);

    const requestSnapshot = {
      id: crypto.randomUUID(), collection_id: null, folder_id: null, name: "Untitled Request",
      method, url: sendUrlForRequest, headers: sendHeaders, query_params: sendQueryParams,
      body_type: sendBody.raw.trim() ? "raw" : "none", body_content: sendBody.raw,
      auth_type: auth.type, auth_config: {}, pre_request_script: preRequestScript,
      pre_request_script_enabled: preRequestScriptEnabled, sort_order: 0,
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
    timeout, sslVerify, activeTabId, preRequestScript, preRequestScriptEnabled]);

  return { handleSendRequest };
}
