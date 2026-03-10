import { useEffect } from 'react';
import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MainPanel } from '@/components/MainPanel/MainPanel';
import { loadAllEnvironments } from '@/lib/environments';
import { useEnvironmentStore } from '@/stores/environmentStore';

export function AppShell() {
  useEffect(() => {
    loadAllEnvironments()
      .then((envs) => useEnvironmentStore.getState().loadAll(envs))
      .catch(() => {}); // swallow gracefully — not available in test env
  }, []);

  return (
    <div className="grid h-screen grid-cols-[16rem_1fr] grid-rows-[3rem_1fr] overflow-hidden">
      <TopBar />
      <Sidebar />
      <MainPanel />
    </div>
  );
}
