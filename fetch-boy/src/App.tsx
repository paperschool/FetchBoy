import { useState } from 'react';
import { AppShell } from '@/components/Layout/AppShell';
import { SplashScreen } from '@/components/Layout/SplashScreen';
import { TourController } from '@/components/Layout/TourController';
import { useRequestStore } from '@/stores/requestStore';

function App() {
  const method = useRequestStore((s) => s.method);
  const [showSplash, setShowSplash] = useState(true);
  const [showTour, setShowTour] = useState(false);

  function handleSplashComplete() {
    setShowSplash(false);
    setTimeout(() => setShowTour(true), 500);
  }

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
    </div>
  );
}

export default App;
