import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { useInterceptStore } from '@/stores/interceptStore'
import { saveSetting } from '@/lib/settings'
import { ProxyPortConfig } from '@/components/Intercept view/ProxyPortConfig'
import { CertificateManagement } from '@/components/Intercept view/CertificateManagement'

interface CaCertificateInfo { certPath: string; certExists: boolean }
type ActionStatus = 'idle' | 'loading' | 'success' | 'error'

export function InterceptSettings(): React.ReactElement {
    const proxyEnabled = useUiSettingsStore((s) => s.proxyEnabled)
    const proxyPort = useUiSettingsStore((s) => s.proxyPort)
    const setProxyPort = useUiSettingsStore((s) => s.setProxyPort)
    const setProxyEnabled = useUiSettingsStore((s) => s.setProxyEnabled)
    const caInstalled = useUiSettingsStore((s) => s.caInstalled)
    const setCaInstalled = useUiSettingsStore((s) => s.setCaInstalled)
    const breakpointTimeout = useInterceptStore((s) => s.breakpointTimeout)
    const setBreakpointTimeout = useInterceptStore((s) => s.setBreakpointTimeout)
    const clearPauseState = useInterceptStore((s) => s.clearPauseState)

    const [portInput, setPortInput] = useState(String(proxyPort))
    const [caCertInfo, setCaCertInfo] = useState<CaCertificateInfo | null>(null)
    const [certStatus, setCertStatus] = useState<ActionStatus>('idle')
    const [certMessage, setCertMessage] = useState('')

    useEffect(() => {
        invoke<CaCertificateInfo>('get_ca_certificate_path').then(setCaCertInfo).catch(() => setCaCertInfo(null))
        invoke<boolean>('is_ca_installed').then((installed) => setCaInstalled(installed)).catch(() => setCaInstalled(false))
    }, [setCaInstalled])

    function handleProxyPortInput(e: React.ChangeEvent<HTMLInputElement>): void { setPortInput(e.target.value) }

    function handleProxyPortCommit(): void {
        const raw = parseInt(portInput, 10)
        const clamped = Math.min(65535, Math.max(1024, isNaN(raw) ? 8080 : raw))
        setPortInput(String(clamped))
        setProxyPort(clamped)
        void saveSetting('proxy_port', clamped)
        void invoke('set_proxy_config', { enabled: proxyEnabled, port: clamped }).catch(() => {})
    }

    async function handleInstallCert(): Promise<void> {
        setCertStatus('loading'); setCertMessage('')
        try {
            await invoke('install_ca_to_system')
            setCertStatus('success'); setCertMessage('Certificate installed and trusted successfully.')
            setCaInstalled(true)
        } catch (err) { setCertStatus('error'); setCertMessage(String(err)) }
    }

    async function handleUninstallCert(): Promise<void> {
        setCertStatus('loading'); setCertMessage('')
        try {
            await invoke('uninstall_ca_from_system')
            if (proxyEnabled) {
                await invoke('unconfigure_system_proxy')
                await invoke('set_proxy_config', { enabled: false, port: proxyPort })
                setProxyEnabled(false); clearPauseState()
                void saveSetting('proxy_enabled', false)
            }
            await invoke('delete_ca_files')
            setCaCertInfo((prev) => prev ? { ...prev, certExists: false } : null)
            setCertStatus('idle'); setCertMessage(''); setCaInstalled(false)
        } catch (err) { setCertStatus('error'); setCertMessage(String(err)) }
    }

    function handleOpenCaFolder(): void {
        if (caCertInfo?.certPath) {
            const caDir = caCertInfo.certPath.substring(0, caCertInfo.certPath.lastIndexOf('/'))
            invoke('open_folder', { path: caDir }).catch((err: unknown) => console.error('Failed to open CA folder:', err))
        }
    }

    function handleCopyPath(): void {
        if (caCertInfo?.certPath) void navigator.clipboard.writeText(caCertInfo.certPath)
    }

    return (
        <div className="space-y-4">
            <h3 className="text-app-muted text-xs font-medium uppercase tracking-wide">Intercept</h3>
            <ProxyPortConfig
                portInput={portInput}
                proxyEnabled={proxyEnabled}
                breakpointTimeout={breakpointTimeout}
                onPortInput={handleProxyPortInput}
                onPortCommit={handleProxyPortCommit}
                onTimeoutChange={setBreakpointTimeout}
            />
            <CertificateManagement
                caCertInfo={caCertInfo}
                caInstalled={caInstalled}
                certStatus={certStatus}
                certMessage={certMessage}
                onInstall={() => void handleInstallCert()}
                onUninstall={() => void handleUninstallCert()}
                onOpenFolder={handleOpenCaFolder}
                onCopyPath={handleCopyPath}
            />
        </div>
    )
}
