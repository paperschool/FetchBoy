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
import type { AuthState, HttpMethod } from "@/stores/requestStore";
import { useTabStore } from "@/stores/tabStore";
import { useHistoryStore } from "@/stores/historyStore";

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
    appendLog(
      `Send clicked with method=${method}, rawUrl=${rawUrl || "<empty>"}`,
    );

    if (!rawUrl) {
      updateRes({
        requestError: "Please enter a URL first.",
        responseData: null,
      });
      appendLog("Validation failed: URL is empty.");
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    appendLog(`Normalized URL: ${normalizedUrl}`);

    const sendUrl = applyEnv(normalizedUrl);
    const sendUrlBase = stripQueryFromUrl(sendUrl);
    const sendUrlForRequest = syncQueryParams ? sendUrlBase : sendUrl;
    if (
      syncQueryParams &&
      !parseUrlWithFallback(sendUrl) &&
      sendUrl.includes("?")
    ) {
      appendLog(
        "Sync Query Parameters: using string-based query stripping fallback for an unparseable URL.",
      );
    }
    const sendHeaders = headers.map((h) => ({
      ...h,
      value: applyEnv(h.value),
    }));
    const sendQueryParams = queryParams.map((q) => ({
      ...q,
      value: applyEnv(q.value),
    }));
    const sendBody = { ...body, raw: applyEnv(body.raw) };
    const requestedUrlForDisplay = buildRequestedUrlForDisplay(
      sendUrlForRequest,
      sendQueryParams,
      auth,
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
      appendLog("Invoking Rust command: send_request");
      const invokePromise = invoke<ResponseData>("send_request", {
        request: {
          method,
          url: sendUrlForRequest,
          headers: sendHeaders,
          queryParams: sendQueryParams,
          body: sendBody,
          auth,
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
  ]);

  return { handleSendRequest };
}
