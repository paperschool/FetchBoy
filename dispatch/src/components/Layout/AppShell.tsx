import { TopBar } from '@/components/TopBar/TopBar';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { MainPanel } from '@/components/MainPanel/MainPanel';

export function AppShell() {
  return (
    <div className="grid h-screen grid-cols-[16rem_1fr] grid-rows-[3rem_1fr] overflow-hidden">
      <TopBar />
      <Sidebar />
      <MainPanel />
    </div>
  );
}
