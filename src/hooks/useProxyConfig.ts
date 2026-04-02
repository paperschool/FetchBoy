import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { showErrorToast } from '@/stores/toastStore';

interface UseProxyConfigReturn {
  setProxyConfig: (enabled: boolean, port: number) => Promise<void>;
  configureSystemProxy: (port: number) => Promise<void>;
  unconfigureSystemProxy: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useProxyConfig(): UseProxyConfigReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setProxyConfig = useCallback(async (enabled: boolean, port: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('set_proxy_config', { enabled, port });
    } catch (err) {
      const message = `Failed to update proxy config: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const configureSystemProxy = useCallback(async (port: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('configure_system_proxy', { port });
    } catch (err) {
      const message = `Failed to configure system proxy: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unconfigureSystemProxy = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('unconfigure_system_proxy');
    } catch (err) {
      const message = `Failed to unconfigure system proxy: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { setProxyConfig, configureSystemProxy, unconfigureSystemProxy, isLoading, error };
}
