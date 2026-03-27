import { FolderOpen, Copy, ShieldCheck, Globe } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

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
  return (
    <>
      {/* CA Certificate paths */}
      {caCertInfo?.certExists && (
        <div className="space-y-1 pt-2 border-t border-gray-700">
          <p className="text-app-muted text-xs font-medium">CA Certificate</p>
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={onOpenFolder} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer">
              <FolderOpen size={12} /> Open Folder
            </button>
            <button onClick={() => invoke("open_proxy_settings").catch((e: unknown) => console.warn("open_proxy_settings:", e))} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer" title="Open OS Proxy Settings">
              <Globe size={12} /> Proxy Settings
            </button>
            <button onClick={() => invoke("open_cert_manager").catch((e: unknown) => console.warn("open_cert_manager:", e))} className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors cursor-pointer" title="Open Certificate Manager">
              <ShieldCheck size={12} /> Cert Manager
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
        <p className="text-app-muted text-xs font-medium">Setup</p>
        {caInstalled ? (
          <button type="button" onClick={onUninstall} disabled={certStatus === "loading"}
            className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Remove CA certificate from OS trust store">
            <ShieldCheck size={12} />
            {certStatus === "loading" ? "Removing…" : "Uninstall Certificate"}
          </button>
        ) : (
          <button type="button" data-tour="install-cert" onClick={onInstall} disabled={certStatus === "loading"}
            className="flex items-center gap-1 px-2 py-1 text-xs text-app-muted hover:text-app-inverse hover:bg-gray-700 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Install CA certificate to OS trust store">
            <ShieldCheck size={12} />
            {certStatus === "loading" ? "Installing…" : "Install Certificate"}
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
