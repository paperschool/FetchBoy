import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import type { ResponseData } from "@/components/ResponseViewer/ResponseViewer";
import { persistHistoryEntry } from "@/lib/history";
import {
  extractErrorReason,
  stripQueryFromUrl,
  parseUrlWithFallback,
  buildRequestedUrlForDisplay,
} from "@/lib/urlUtils";
import { executePreRequestScript, type ScriptError } from "@/lib/scriptEngine";
import type { AuthState, HttpMethod } from "@/stores/requestStore";
import { useTabStore } from "@/stores/tabStore";
import { useHistoryStore } from "@/stores/historyStore";
import { useEnvironmentStore } from "@/stores/environmentStore";
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

function invokeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(
        new Error(`Timed out after ${timeoutMs}ms waiting for Rust response`),
      );
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
}

export function useSendRequest(params: UseSendRequestParams): {
  handleSendRequest: () => Promise<void>;
} {
  const {
    url,
    method,
    headers,
    queryParams,
    body,
    auth,
    syncQueryParams,
    applyEnv,
    timeout,
    sslVerify,
    activeTabId,
    abortControllerRef,
    updateRes,
    setRequestDetailsOpen,
    preRequestScript,
    preRequestScriptEnabled,
  } = params;

  const historyStore = useHistoryStore();

  const appendLog = useCallback(
    (message: string) => {
      const timestamp = new Date().toISOString();
      const { activeTabId: tabId, appendResponseLog } =
        useTabStore.getState();
      appendResponseLog(tabId, `[${timestamp}] ${message}`);
    },
    [],
  );

  const handleSendRequest = useCallback(async () => {
    const rawUrl = url.trim();
    emitDebug('info', `${method} ${rawUrl || '<empty>'} — send initiated`);
    appendLog(
      `Send clicked with method=${method}, rawUrl=${rawUrl || "<empty>"}`,
    );

    if (!rawUrl) {
      updateRes({
        requestError: "Please enter a URL first.",
        responseData: null,
      });
      emitDebug('warn', 'Send aborted — URL is empty');
      appendLog("Validation failed: URL is empty.");
      return;
    }

    const interpolatedUrl = applyEnv(rawUrl);
    const sendUrl = /^https?:\/\//i.test(interpolatedUrl)
      ? interpolatedUrl
      : `https://${interpolatedUrl}`;
    emitDebug('info', `Resolved URL: ${sendUrl}`);
    appendLog(`Resolved URL: ${sendUrl}`);
    const sendUrlBase = stripQueryFromUrl(sendUrl);
    let sendUrlForRequest = syncQueryParams ? sendUrlBase : sendUrl;
    if (
      syncQueryParams &&
      !parseUrlWithFallback(sendUrl) &&
      sendUrl.includes("?")
    ) {
      appendLog(
        "Sync Query Parameters: using string-based query stripping fallback for an unparseable URL.",
      );
    }
    let sendHeaders = headers.map((h) => ({
      ...h,
      value: applyEnv(h.value),
    }));
    let sendQueryParams = queryParams.map((q) => ({
      ...q,
      value: applyEnv(q.value),
    }));
    let sendBody = { ...body, raw: applyEnv(body.raw) };

    // Interpolate environment variables in auth fields.
    const sendAuth = { ...auth } as Record<string, string>;
    for (const key of Object.keys(sendAuth)) {
      if (typeof sendAuth[key] === 'string') {
        sendAuth[key] = applyEnv(sendAuth[key]);
      }
    };

    // Pre-request script execution
    if (preRequestScript.trim() && preRequestScriptEnabled) {
      emitDebug('info', 'Executing pre-request script');
      appendLog("Executing pre-request script...");
      try {
        const envStore = useEnvironmentStore.getState();
        const envVars: Record<string, string> = {};
        for (const env of envStore.environments) {
          if (env.is_active) {
            for (const v of env.variables) {
              if (v.enabled) envVars[v.key] = v.value;
            }
          }
        }

        const scriptResult = await executePreRequestScript(preRequestScript, {
          url: sendUrlForRequest,
          method,
          headers: sendHeaders,
          queryParams: sendQueryParams,
          body: sendBody.raw,
          envVars,
        });

        // Apply script modifications
        sendUrlForRequest = scriptResult.url;
        sendHeaders = scriptResult.headers;
        sendQueryParams = scriptResult.queryParams;
        sendBody = { ...sendBody, raw: scriptResult.body };

        // Persist env mutations
        if (Object.keys(scriptResult.envMutations).length > 0) {
          const activeEnv = envStore.environments.find((e) => e.is_active);
          if (activeEnv) {
            const updatedVars = [...activeEnv.variables];
            for (const [key, value] of Object.entries(scriptResult.envMutations)) {
              const existing = updatedVars.find((v) => v.key === key);
              if (existing) {
                existing.value = value;
              } else {
                updatedVars.push({ key, value, enabled: true });
              }
            }
            envStore.updateVariables(activeEnv.id, updatedVars);
          }
          appendLog(`Pre-request script set ${Object.keys(scriptResult.envMutations).length} env var(s).`);
        }

        emitDebug('info', 'Pre-request script completed');
        appendLog("Pre-request script completed successfully.");
      } catch (scriptError) {
        const err = scriptError as ScriptError;
        const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
        const message = `Pre-request script error${lineInfo}: ${err.message}`;
        emitDebug('error', message);
        updateRes({
          requestError: message,
          responseData: null,
          isSending: false,
        });
        appendLog(`Script error: ${message}`);
        return;
      }
    }

    const requestedUrlForDisplay = buildRequestedUrlForDisplay(
      sendUrlForRequest,
      sendQueryParams,
      sendAuth as AuthState,
    );

    const controller = new AbortController();
    abortControllerRef.current = controller;

    updateRes({
      isSending: true,
      requestError: null,
      responseData: null,
      wasCancelled: false,
      wasTimedOut: false,
      timedOutAfterSec: null,
      sentUrl: requestedUrlForDisplay,
    });

    // Auto-close request details accordion when sending
    setRequestDetailsOpen(false);

    const requestSnapshot = {
      id: crypto.randomUUID(),
      collection_id: null,
      folder_id: null,
      name: "Untitled Request",
      method,
      url: sendUrlForRequest,
      headers: sendHeaders,
      query_params: sendQueryParams,
      body_type: sendBody.raw.trim() ? "raw" : "none",
      body_content: sendBody.raw,
      auth_type: auth.type,
      auth_config: {},
      pre_request_script: preRequestScript,
      pre_request_script_enabled: preRequestScriptEnabled,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as const;

    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new DOMException("AbortError", "AbortError"));
      });
    });

    try {
      emitDebug('info', `${method} ${sendUrlForRequest} — sending (timeout: ${timeout}ms, auth: ${auth.type})`);
      appendLog("Invoking Rust command: send_request");
      const invokePromise = invoke<ResponseData>("send_request", {
        request: {
          method,
          url: sendUrlForRequest,
          headers: sendHeaders,
          queryParams: sendQueryParams,
          body: sendBody,
          auth: sendAuth,
          timeoutMs: timeout,
          sslVerify: sslVerify,
          requestId: activeTabId,
        },
      });
      const timedInvoke =
        timeout > 0
          ? invokeWithTimeout(invokePromise, timeout + 5000)
          : invokePromise;
      const response = await Promise.race([timedInvoke, abortPromise]);

      emitDebug('info', `${method} ${sendUrlForRequest} — ${response.status} in ${response.responseTimeMs}ms (${response.responseSizeBytes} bytes)`);
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
      appendLog("History persisted for successful response.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        emitDebug('warn', `${method} ${sendUrlForRequest} — cancelled by user`);
        updateRes({
          isSending: false,
          wasCancelled: true,
          responseData: null,
          requestError: null,
        });
        appendLog("Request cancelled by user.");
        return;
      }

      const reason = extractErrorReason(error);
      if (reason === "__CANCELLED__") {
        emitDebug('warn', `${method} ${sendUrlForRequest} — cancelled by user`);
        updateRes({
          isSending: false,
          wasCancelled: true,
          responseData: null,
          requestError: null,
        });
        appendLog("Request cancelled by user.");
        return;
      }

      if (reason === "__TIMEOUT__") {
        const sec = timeout > 0 ? timeout / 1000 : 0;
        emitDebug('warn', `${method} ${sendUrlForRequest} — timed out after ${sec}s`);
        updateRes({
          isSending: false,
          wasTimedOut: true,
          timedOutAfterSec: sec,
          responseData: null,
          requestError: null,
        });
        appendLog(`Request timed out after ${sec}s.`);
        return;
      }

      const message = `Request failed: ${reason}`;
      emitDebug('error', `${method} ${sendUrlForRequest} — ${reason}`);
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
        appendLog("History persisted for failed response.");
      } catch {
        appendLog("History persistence failed after request failure.");
      }
    } finally {
      abortControllerRef.current = null;
      updateRes({ isSending: false });
      appendLog("Send flow completed.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    url,
    method,
    headers,
    queryParams,
    body,
    auth,
    syncQueryParams,
    applyEnv,
    timeout,
    sslVerify,
    activeTabId,
    preRequestScript,
    preRequestScriptEnabled,
  ]);

  return { handleSendRequest };
}
