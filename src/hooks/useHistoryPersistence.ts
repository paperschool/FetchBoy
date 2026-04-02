import { useCallback } from 'react';
import { persistHistoryEntry } from '@/lib/history';
import { useHistoryStore } from '@/stores/historyStore';
import type { Request } from '@/lib/db';

interface UseHistoryPersistenceReturn {
  persistToHistory: (
    method: string,
    url: string,
    statusCode: number,
    responseTimeMs: number,
    requestSnapshot: Request,
  ) => Promise<void>;
}

export function useHistoryPersistence(): UseHistoryPersistenceReturn {
  const historyStore = useHistoryStore();

  const persistToHistory = useCallback(
    async (
      method: string,
      url: string,
      statusCode: number,
      responseTimeMs: number,
      requestSnapshot: Request,
    ): Promise<void> => {
      const entry = await persistHistoryEntry({
        method,
        url,
        statusCode,
        responseTimeMs,
        requestSnapshot,
      });
      historyStore.addEntry(entry);
    },
    [historyStore],
  );

  return { persistToHistory };
}
