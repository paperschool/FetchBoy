import { useEffect, useState } from 'react'
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
 * Returns `shuttingDown: true` while the proxy is being stopped on close,
 * so the caller can show a progress overlay.
 *
 * The Rust RunEvent::Exit hook is a safety net that also stops the proxy and
 * clears OS settings — this hook handles the persisted SQLite state.
 */
export function useProxyExitCleanup(): { shuttingDown: boolean } {
  const [shuttingDown, setShuttingDown] = useState(false)

  useEffect(() => {
    let unlisten: (() => void) | undefined

    getCurrentWindow()
      .onCloseRequested(async (event) => {
        event.preventDefault()

        setShuttingDown(true)

        // Persist disabled state so the next launch doesn't re-enable it unexpectedly.
        await saveSetting('proxy_enabled', false).catch(() => {})

        // Reset in-memory store.
        useUiSettingsStore.getState().setProxyEnabled(false)

        // Stop the proxy and exit the process from Rust — this guarantees the
        // window actually closes regardless of JS window API quirks.
        // Race against a hard timeout so a hung DB write can never trap the user.
        await Promise.race([
          invoke('exit_app'),
          new Promise<void>((resolve) => setTimeout(resolve, 3000)),
        ]).catch(() => {})

        // Fallback: if exit_app didn't terminate us within the timeout, force it.
        invoke('exit_app').catch(() => {})
      })
      .then((fn) => {
        unlisten = fn
      })
      .catch(() => {
        // Not in a Tauri environment (e.g. tests) — skip.
      })

    return () => unlisten?.()
  }, [])

  return { shuttingDown }
}
