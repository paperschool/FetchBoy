import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface MatchResult {
  matches: boolean;
}

interface UseBreakpointMatchingReturn {
  matchUrl: (url: string, pattern: string, matchType: string) => Promise<boolean>;
  computeMatchCount: (urls: string[], pattern: string, matchType: string) => void;
  matchCount: number | null;
  isMatching: boolean;
}

const DEBOUNCE_MS = 300;

export function useBreakpointMatching(): UseBreakpointMatchingReturn {
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const matchUrl = useCallback(async (url: string, pattern: string, matchType: string): Promise<boolean> => {
    try {
      const result = await invoke<MatchResult>('match_breakpoint_url', {
        url, pattern, matchType,
      });
      return result.matches;
    } catch {
      return false;
    }
  }, []);

  const computeMatchCount = useCallback((urls: string[], pattern: string, matchType: string): void => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!pattern.trim()) {
      setMatchCount(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setIsMatching(true);
      void (async () => {
        let count = 0;
        for (const url of urls) {
          try {
            const result = await invoke<MatchResult>('match_breakpoint_url', {
              url, pattern, matchType,
            });
            if (result.matches) count++;
          } catch {
            // pattern invalid — skip
          }
        }
        setMatchCount(count);
        setIsMatching(false);
      })();
    }, DEBOUNCE_MS);
  }, []);

  return { matchUrl, computeMatchCount, matchCount, isMatching };
}
