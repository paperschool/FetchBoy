import { CollectionTree } from '@/components/CollectionTree/CollectionTree';

export function Sidebar() {
  return (
    <aside
      data-testid="sidebar"
      className="bg-app-sidebar text-app-inverse overflow-y-auto p-3"
    >
      <CollectionTree />
    </aside>
  );
}
