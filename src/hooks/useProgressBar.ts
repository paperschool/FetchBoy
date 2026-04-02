import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import { useRequestProgressStore } from "@/hooks/useRequestProgress";
import { useTabStore } from "@/stores/tabStore";
import { PROGRESS_MAX_BEFORE_COMPLETE, PROGRESS_INCREMENT_PER_TICK, PROGRESS_UPDATE_INTERVAL_MS } from "@/lib/constants";

interface UseProgressBarParams {
  isSending: boolean;
  responseData: unknown;
  requestError: string | null;
  wasCancelled: boolean;
  wasTimedOut: boolean;
  activeTabId: string;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

interface UseProgressBarReturn {
  progressState: {
    isRequestInFlight: boolean;
    requestProgress: number;
  };
  handleCancelRequest: () => void;
  handleProgressComplete: () => void;
}

export function useProgressBar(params: UseProgressBarParams): UseProgressBarReturn {
  const {
    isSending,
    responseData,
    requestError,
    wasCancelled,
    wasTimedOut,
    activeTabId,
    abortControllerRef,
  } = params;

  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = (): void => {
    useRequestProgressStore.getState().startRequest();

    progressRef.current = setInterval(() => {
      const current = useRequestProgressStore.getState().requestProgress;
      if (current < PROGRESS_MAX_BEFORE_COMPLETE) {
        useRequestProgressStore.getState().updateProgress(current + PROGRESS_INCREMENT_PER_TICK);
      }
    }, PROGRESS_UPDATE_INTERVAL_MS);
  };

  const stopProgress = (): void => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
  };

  const progressState = useRequestProgressStore();

  useEffect(() => {
    if (isSending) {
      startProgress();
    } else {
      stopProgress();
      if (responseData || requestError || wasCancelled || wasTimedOut) {
        useRequestProgressStore.getState().completeRequest();
      }
    }

    return () => {
      stopProgress();
    };
  }, [isSending, responseData, requestError, wasCancelled, wasTimedOut]);

  const handleCancelRequest = (): void => {
    abortControllerRef.current?.abort();
    invoke("cancel_request", { requestId: activeTabId }).catch(() => {});
    useRequestProgressStore.getState().cancelRequest();
    const timestamp = new Date().toISOString();
    const { activeTabId: tabId, appendResponseLog } = useTabStore.getState();
    appendResponseLog(tabId, `[${timestamp}] Cancel requested by user.`);
  };

  const handleProgressComplete = (): void => {
    useRequestProgressStore.getState().reset();
  };

  return { progressState, handleCancelRequest, handleProgressComplete };
}
