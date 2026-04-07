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
import { useEnvironmentStore } from "@/stores/environmentStore";
import { useHistoryPersistence } from "@/hooks/useHistoryPersistence";
import type { AuthState, HttpMethod } from "@/stores/requestStore";
import { useTabStore, createDefaultScriptDebugState } from "@/stores/tabStore";
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
  scriptKeepOpen: boolean;
  preRequestChainId?: string | null;
  preRequestMode?: 'none' | 'javascript' | 'chain';
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
    scriptKeepOpen, preRequestChainId, preRequestMode } = params;

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

    // Pre-request chain execution (chain mode takes priority over JS)
    if (preRequestMode === 'chain' && preRequestChainId) {
      emitDebug('info', 'Executing pre-request chain');
      appendLog('Executing pre-request chain...');
      try {
        const { loadChainWithNodes } = await import('@/lib/stitch');
        const { executeChain } = await import('@/lib/stitchEngine');
        const { chain, nodes, connections } = await loadChainWithNodes(preRequestChainId);
        emitDebug('info', `Loaded pre-request chain: ${chain.name} (${nodes.length} nodes)`);

        const envState = useEnvironmentStore.getState();
        const activeEnv = envState.environments.find((e) => e.id === envState.activeEnvironmentId);
        const envVars: Record<string, string> = {};
        if (activeEnv?.variables) {
          for (const v of activeEnv.variables) {
            if (v.enabled && v.key) envVars[v.key] = v.value;
          }
        }

        const cancelledRef = { current: false };
        const noopCallbacks = {
          onNodeStart: () => {},
          onNodeComplete: () => {},
          onError: () => {},
          onSleepStart: () => {},
          onChainComplete: () => {},
        };

        const ctx = await Promise.race([
          executeChain(nodes, connections, envVars, noopCallbacks, cancelledRef),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Pre-request chain timed out after 30s')), 30000)),
        ]);

        if (ctx.status === 'error' && ctx.error) {
          const message = `Pre-request chain error: ${ctx.error.message}`;
          emitDebug('error', message);
          updateRes({ requestError: message, responseData: null, isSending: false });
          appendLog(message);
          return;
        }

        // Collect fetch-terminal node output and inject into request fields
        const terminalNode = nodes.find((n) => n.type === 'fetch-terminal');
        if (terminalNode) {
          const terminalOutput = ctx.nodeOutputs[terminalNode.id] as Record<string, unknown> | undefined;
          if (terminalOutput && typeof terminalOutput === 'object') {
            const chainVars: Array<{ key: string; value: string; enabled: boolean }> = [];
            for (const [k, v] of Object.entries(terminalOutput)) {
              if (k === 'complete') continue;
              chainVars.push({ key: k, value: String(v), enabled: true });
            }
            if (chainVars.length > 0) {
              const applyChain = (s: string): string =>
                s.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
                  const found = chainVars.find((cv) => cv.key === key.trim());
                  return found ? found.value : _match;
                });
              sendUrlForRequest = applyChain(sendUrlForRequest);
              sendHeaders = sendHeaders.map((h) => ({ ...h, value: applyChain(h.value) }));
              sendQueryParams = sendQueryParams.map((q) => ({ ...q, value: applyChain(q.value) }));
              sendBody = { ...sendBody, raw: applyChain(sendBody.raw) };
              emitDebug('info', `Chain output injected: ${chainVars.map((v) => v.key).join(', ')}`);
              appendLog(`Chain variables applied: ${chainVars.map((v) => `${v.key}=${v.value}`).join(', ')}`);
            }
          }
        }

        emitDebug('info', 'Pre-request chain completed');
        appendLog('Pre-request chain completed successfully.');
      } catch (chainErr) {
        const message = `Pre-request chain error: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}`;
        emitDebug('error', message);
        updateRes({ requestError: message, responseData: null, isSending: false });
        appendLog(message);
        return;
      }
    }

    // Pre-request script execution
    if (preRequestScript.trim() && preRequestScriptEnabled && preRequestMode !== 'chain') {
      emitDebug('info', 'Executing pre-request script');
      appendLog("Executing pre-request script...");

      const inputSnap = { url: sendUrlForRequest, method, headers: sendHeaders, queryParams: sendQueryParams, body: sendBody.raw };
      const { updateTabScriptDebugState } = useTabStore.getState();
      updateTabScriptDebugState(activeTabId, {
        ...createDefaultScriptDebugState(), status: 'running', startTime: Date.now(), inputSnapshot: inputSnap,
      });

      try {
        const result = await executePreScript(preRequestScript, {
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
        updateTabScriptDebugState(activeTabId, {
          status: 'completed', endTime: Date.now(),
          consoleLogs: result.consoleLogs, httpLogs: result.httpLogs, outputSnapshot: outputSnap,
        });
        emitDebug('info', 'Pre-request script completed');
        appendLog("Pre-request script completed successfully.");
      } catch (scriptError) {
        const err = scriptError as ScriptError & { consoleLogs?: unknown[]; httpLogs?: unknown[] };
        const lineInfo = err.lineNumber ? ` (line ${err.lineNumber})` : '';
        const message = `Pre-request script error${lineInfo}: ${err.message}`;
        updateTabScriptDebugState(activeTabId, {
          status: 'error', endTime: Date.now(), error: { message: err.message, lineNumber: err.lineNumber },
          consoleLogs: (err.consoleLogs ?? []) as never[], httpLogs: (err.httpLogs ?? []) as never[],
        });
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
      pre_request_script_enabled: preRequestScriptEnabled, pre_request_chain_id: null, sort_order: 0,
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
    timeout, sslVerify, activeTabId, preRequestScript, preRequestScriptEnabled,
    scriptKeepOpen, preRequestChainId, preRequestMode]);

  return { handleSendRequest };
}
