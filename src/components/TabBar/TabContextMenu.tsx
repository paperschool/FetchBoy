type TabContextMenuState = { x: number; y: number; tabId: string } | null;

interface TabContextMenuProps {
  menu: TabContextMenuState;
  onClose: () => void;
  isMac: boolean;
  tabCount: number;
  onNewTab: () => void;
  onDuplicateTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onCloseOtherTabs: (tabId: string) => void;
  onCloseAllTabs: () => void;
}

export function TabContextMenu({
  menu,
  onClose,
  isMac,
  tabCount,
  onNewTab,
  onDuplicateTab,
  onCloseTab,
  onCloseOtherTabs,
  onCloseAllTabs,
}: TabContextMenuProps): React.ReactElement | null {
  if (!menu) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <ul
        role="menu"
        className="fixed z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm text-app-primary"
        style={{ top: menu.y, left: menu.x }}
        onClick={(e) => e.stopPropagation()}
      >
        <li role="menuitem" className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-app-subtle"
          onClick={() => { onNewTab(); onClose(); }}>
          <span>New Tab</span>
          <span className="ml-auto text-xs text-app-muted">{isMac ? '⌘T' : 'Ctrl+T'}</span>
        </li>
        <li role="menuitem" className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
          onClick={() => { onDuplicateTab(menu.tabId); onClose(); }}>
          Duplicate Tab
        </li>
        <li role="menuitem" className="flex cursor-pointer items-center px-3 py-1.5 hover:bg-app-subtle"
          onClick={() => { onCloseTab(menu.tabId); onClose(); }}>
          <span>Close Tab</span>
          <span className="ml-auto text-xs text-app-muted">{isMac ? '⌘W' : 'Ctrl+W'}</span>
        </li>
        <li role="menuitem"
          className={`px-3 py-1.5 ${tabCount === 1 ? 'cursor-not-allowed text-app-muted' : 'cursor-pointer hover:bg-app-subtle'}`}
          onClick={() => { if (tabCount > 1) { onCloseOtherTabs(menu.tabId); onClose(); } }}>
          Close Other Tabs
        </li>
        <li role="menuitem" className="px-3 py-1.5 hover:bg-app-subtle cursor-pointer"
          onClick={() => { onCloseAllTabs(); onClose(); }}>
          Close All Tabs
        </li>
      </ul>
    </>
  );
}
