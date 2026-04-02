import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface UseSystemOperationsReturn {
  openProxySettings: () => void;
  openCertManager: () => void;
  openFolder: (path: string) => void;
  openLogFolder: () => void;
}

export function useSystemOperations(): UseSystemOperationsReturn {
  const openProxySettings = useCallback((): void => {
    invoke('open_proxy_settings').catch((e: unknown) =>
      console.warn('open_proxy_settings:', e),
    );
  }, []);

  const openCertManager = useCallback((): void => {
    invoke('open_cert_manager').catch((e: unknown) =>
      console.warn('open_cert_manager:', e),
    );
  }, []);

  const openFolder = useCallback((path: string): void => {
    invoke('open_folder', { path }).catch((err: unknown) =>
      console.error('Failed to open folder:', err),
    );
  }, []);

  const openLogFolder = useCallback((): void => {
    invoke('open_log_folder').catch((e: unknown) =>
      console.warn('open_log_folder:', e),
    );
  }, []);

  return { openProxySettings, openCertManager, openFolder, openLogFolder };
}
