import { useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import { useUiSettingsStore } from '@/stores/uiSettingsStore'
import { saveSetting } from '@/lib/settings'

/**
 * Intercepts the window close event to:
 * 1. Stop the proxy server and clear OS proxy settings via Tauri command
 * 2. Persist proxy_enabled = false so the next launch starts with proxy off
 * 3. Reset the store so in-session UI reflects the stopped state
 *
 * The Rust RunEvent::Exit hook is a safety net that also stops the proxy and
 * clears OS settings — this hook handles the persisted SQLite state.
 */
export function useProxyExitCleanup(): void {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault()

        const port = useUiSettingsStore.getState().proxyPort

        // Stop the proxy backend and clear OS proxy settings.
        await invoke('set_proxy_config', { enabled: false, port }).catch(() => {})

        // Persist disabled state so the next launch doesn't re-enable it unexpectedly.
        await saveSetting('proxy_enabled', false).catch(() => {})

        // Reset in-memory store (cosmetic — window is closing, but keeps state clean).
        useUiSettingsStore.getState().setProxyEnabled(false)

        // Proceed with close now that cleanup is done.
        await getCurrentWindow().destroy()
      })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {
        // Not in a Tauri environment (e.g. tests) — skip.
      })

    return () => unlisten?.()
  }, [])
}
