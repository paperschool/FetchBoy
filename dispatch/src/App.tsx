import { AppShell } from '@/components/Layout/AppShell';
import { useRequestStore } from '@/stores/requestStore';

function App() {
  const method = useRequestStore((s) => s.method);

  return (
    <>
      {/* method is consumed here to verify store wiring; hidden visually */}
      <span data-testid="active-method" className="sr-only">
        {method}
      </span>
      <AppShell />
    </>
  );
}

export default App;
