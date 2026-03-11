import { useEffect, useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell';
import { SplashScreen } from '@/components/Layout/SplashScreen';
import { TourController } from '@/components/Layout/TourController';
import { KeyboardShortcutsModal } from '@/components/ui/KeyboardShortcutsModal';
import { useRequestStore } from '@/stores/requestStore';
import { useTourStore } from '@/stores/tourStore';
import { seedSampleDataIfNeeded } from '@/lib/seedSampleData';

function App() {
  const method = useRequestStore((s) => s.method);
  const hasCompletedTour = useTourStore((s) => s.hasCompletedTour);
  const [showSplash, setShowSplash] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  function handleSplashComplete() {
    setShowSplash(false);
    setTimeout(() => setShowTour(true), 500);
  }

  useEffect(() => {
    if (!showSplash && hasCompletedTour) {
      seedSampleDataIfNeeded().catch(() => {});
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
      <AppShell />
      <KeyboardShortcutsModal
        open={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
    </div>
  );
}

export default App;
