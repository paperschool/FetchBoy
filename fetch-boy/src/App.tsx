import { useEffect, useState } from 'react';
import { AppTabs } from '@/components/AppTabs/AppTabs';
import { FetchView } from '@/components/FetchView/FetchView';
import { SplashScreen } from '@/components/Layout/SplashScreen';
import { TourController } from '@/components/Layout/TourController';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';
import { WhatsNewModal } from '@/components/ui/WhatsNewModal';
import { useRequestStore } from '@/stores/requestStore';
import { useTourStore } from '@/stores/tourStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { seedSampleDataIfNeeded } from '@/lib/seedSampleData';
import { getCurrentVersion, isNewVersion } from '@/lib/appVersion';
import { parseChangelog } from '@/lib/parseChangelog';
import changelogRaw from '../../CHANGELOG.md?raw';

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
  const method = useRequestStore((s) => s.method);
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const [showSplash, setShowSplash] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  function handleSplashComplete() {
    setShowSplash(false);
    setTimeout(() => setShowTour(true), 500);
  }

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
    return <SplashScreen onComplete={handleSplashComplete} />;
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
    </div>
  );
}

export default App;
