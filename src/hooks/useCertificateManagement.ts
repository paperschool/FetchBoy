import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { showErrorToast } from '@/stores/toastStore';

interface CaCertificateInfo {
  certPath: string;
  certExists: boolean;
}

interface UseCertificateManagementReturn {
  installCert: () => Promise<void>;
  uninstallCert: () => Promise<void>;
  deleteCertFiles: () => Promise<void>;
  verifyCertInstalled: () => Promise<boolean>;
  getCaCertificatePath: () => Promise<CaCertificateInfo | null>;
  isLoading: boolean;
  error: string | null;
}

export function useCertificateManagement(): UseCertificateManagementReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const installCert = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('install_ca_to_system');
    } catch (err) {
      const message = `Failed to install certificate: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uninstallCert = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('uninstall_ca_from_system');
    } catch (err) {
      const message = `Failed to uninstall certificate: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteCertFiles = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      await invoke('delete_ca_files');
    } catch (err) {
      const message = `Failed to delete certificate files: ${String(err)}`;
      setError(message);
      showErrorToast(message, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyCertInstalled = useCallback(async (): Promise<boolean> => {
    try {
      return await invoke<boolean>('is_ca_installed');
    } catch (err) {
      console.error('Failed to verify certificate:', err);
      return false;
    }
  }, []);

  const getCaCertificatePath = useCallback(async (): Promise<CaCertificateInfo | null> => {
    try {
      return await invoke<CaCertificateInfo>('get_ca_certificate_path');
    } catch {
      return null;
    }
  }, []);

  return {
    installCert, uninstallCert, deleteCertFiles,
    verifyCertInstalled, getCaCertificatePath,
    isLoading, error,
  };
}
