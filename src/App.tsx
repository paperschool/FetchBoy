import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AppTabs } from '@/components/AppTabs/AppTabs';
import { FetchView } from '@/components/FetchView/FetchView';
import { TourController } from '@/components/Layout/TourController';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';
import { WhatsNewModal } from '@/components/ui/WhatsNewModal';
import { useProxyExitCleanup } from '@/hooks/useProxyExitCleanup';
import { useRequestStore } from '@/stores/requestStore';
import { useTourStore } from '@/stores/tourStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { seedSampleDataIfNeeded } from '@/lib/seedSampleData';
import { getCurrentVersion, isNewVersion } from '@/lib/appVersion';
import { parseChangelog } from '@/lib/parseChangelog';
import changelogRaw from '../CHANGELOG.md?raw';

declare global {
  interface Window {
    __splashReady?: boolean;
    __splashCleanup?: () => void;
  }
}

async function persistLastSeenVersion(version: string): Promise<void> {
  try {
    const { getDb } = await import('@/lib/db');
    const db = await getDb();
    await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      'last_seen_version',
      JSON.stringify(version),
    ]);
  } catch {
    // Not in a Tauri environment — skip
  }
}

function App() {
  const { shuttingDown } = useProxyExitCleanup();

  const method = useRequestStore((s) => s.method);
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const [showSplash, setShowSplash] = useState(!window.__splashReady);
  const [showTour, setShowTour] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  // Wait for the static splash to finish, then hide it and show the app
  useEffect(() => {
    if (!showSplash) {
      // Already done (e.g. React loaded after 5s)
      window.__splashCleanup?.();
      return;
    }

    function onReady() {
      setShowSplash(false);
      window.__splashCleanup?.();
      setTimeout(() => setShowTour(true), 500);
    }

    // If splash already finished before React mounted
    if (window.__splashReady) {
      onReady();
      return;
    }

    window.addEventListener('splash-ready', onReady, { once: true });
    return () => window.removeEventListener('splash-ready', onReady);
  }, [showSplash]);

  // Set window title with version
  useEffect(() => {
    import('@tauri-apps/api/webviewWindow').then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().setTitle(`Fetch Boy - v${getCurrentVersion()}`).catch(() => {});
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showSplash && hasCompletedTour) {
      seedSampleDataIfNeeded().catch(() => {});
      const lastSeen = useUiSettingsStore.getState().lastSeenVersion;
      const currentVersion = getCurrentVersion();
      if (isNewVersion(lastSeen)) {
        setShowWhatsNew(true);
        useUiSettingsStore.getState().setLastSeenVersion(currentVersion);
        persistLastSeenVersion(currentVersion);
      }
    }
  }, [showSplash, hasCompletedTour]);

  useEffect(() => {
    const unlisten = listen('menu:restart-tutorial', () => {
      useTourStore.getState().resetTour();
      setShowTour(true);
    });
    return () => { void unlisten.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) &&
        !(e.target as HTMLElement).closest('.monaco-editor')
      ) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (showSplash) {
    // Static HTML splash is already visible — render nothing until it finishes
    return null;
  }

  return (
    <div style={{ animation: 'app-fade-in 0.3s ease-out forwards' }}>
      {/* method is consumed here to verify store wiring; hidden visually */}
      <span data-testid="active-method" className="sr-only">
        {method}
      </span>
      {showTour && <TourController />}
      <AppTabs>
        <FetchView />
      </AppTabs>
      <KeyboardShortcutsModal
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      {showWhatsNew && (
        <WhatsNewModal
          version={getCurrentVersion()}
          changelog={parseChangelog(changelogRaw)}
          onDismiss={() => setShowWhatsNew(false)}
        />
      )}
      {shuttingDown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-app-sidebar border border-app-subtle rounded-xl px-8 py-6 flex flex-col items-center gap-3 shadow-2xl">
            <div className="w-5 h-5 border-2 border-app-muted border-t-blue-400 rounded-full animate-spin" />
            <p className="text-app-inverse text-sm font-medium">Shutting down proxy…</p>
            <p className="text-app-muted text-xs">Saving state and closing connections</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
