import { FolderOpen, Copy, ShieldCheck, Globe } from "lucide-react";
import { useSystemOperations } from "@/hooks/useSystemOperations";
import { t } from "@/lib/i18n";

interface CaCertificateInfo {
  certPath: string;
  certExists: boolean;
}

type ActionStatus = "idle" | "loading" | "success" | "error";

interface CertificateManagementProps {
  caCertInfo: CaCertificateInfo | null;
  caInstalled: boolean;
  certStatus: ActionStatus;
  certMessage: string;
  onInstall: () => void;
  onUninstall: () => void;
  onOpenFolder: () => void;
  onCopyPath: () => void;
}

export function CertificateManagement({
  caCertInfo,
  caInstalled,
  certStatus,
  certMessage,
  onInstall,
  onUninstall,
  onOpenFolder,
  onCopyPath,
}: CertificateManagementProps): React.ReactElement | null {
  const { openProxySettings, openCertManager } = useSystemOperations();

  return (
    <>
      {/* CA Certificate paths */}
      {caCertInfo?.certExists && (
        <div className="space-y-1 pt-2 border-t border-gray-700">
          <p className="text-app-muted text-xs font-medium">{t('intercept.caCertificate')}</p>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={onOpenFolder} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer">
              <FolderOpen size={12} /> {t('intercept.openFolder')}
            </button>
            <button onClick={openProxySettings} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer" title={t('intercept.proxySettings')}>
              <Globe size={12} /> {t('intercept.proxySettings')}
            </button>
            <button onClick={openCertManager} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer" title={t('intercept.certManager')}>
              <ShieldCheck size={12} /> {t('intercept.certManager')}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <p className="text-xs text-app-muted opacity-70 truncate flex-1">{caCertInfo.certPath}</p>
            <button onClick={onCopyPath} className="text-app-muted hover:text-app-inverse shrink-0 cursor-pointer" title="Copy path">
              <Copy size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Install / Uninstall */}
      <div className="space-y-1 pt-2 border-t border-gray-700">
        <p className="text-app-muted text-xs font-medium">{t('intercept.setup')}</p>
        {caInstalled ? (
          <button type="button" onClick={onUninstall} disabled={certStatus === "loading"}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('intercept.uninstallCertificate')}>
            <ShieldCheck size={12} />
            {certStatus === "loading" ? t('intercept.removing') : t('intercept.uninstallCertificate')}
          </button>
        ) : (
          <button type="button" data-tour="install-cert" onClick={onInstall} disabled={certStatus === "loading"}
            className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('intercept.installCertificate')}>
            <ShieldCheck size={12} />
            {certStatus === "loading" ? t('intercept.installing') : t('intercept.installCertificate')}
          </button>
        )}
        {certMessage && (
          <p className={`text-xs px-1 ${certStatus === "error" ? "text-red-400" : "text-green-400"}`}>
            {certMessage}
          </p>
        )}
      </div>
    </>
  );
}
