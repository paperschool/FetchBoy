export interface KeyboardShortcut {
  id: string;
  displayName: string;
  category: 'general' | 'request' | 'tabs';
  macKeys: string;
  windowsKeys: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: 'send-request',
    displayName: 'Send Request',
    category: 'request',
    macKeys: '⌘+Enter',
    windowsKeys: 'Ctrl+Enter',
  },
  {
    id: 'toggle-sidebar',
    displayName: 'Toggle Sidebar',
    category: 'general',
    macKeys: '⌘+B',
    windowsKeys: 'Ctrl+B',
  },
  {
    id: 'new-tab',
    displayName: 'New Tab',
    category: 'tabs',
    macKeys: '⌘+T',
    windowsKeys: 'Ctrl+T',
  },
  {
    id: 'close-tab',
    displayName: 'Close Tab',
    category: 'tabs',
    macKeys: '⌘+W',
    windowsKeys: 'Ctrl+W',
  },
  {
    id: 'next-tab',
    displayName: 'Next Tab',
    category: 'tabs',
    macKeys: '⌘+Tab',
    windowsKeys: 'Ctrl+Tab',
  },
];

export function getShortcutDisplay(isMac: boolean, shortcut: KeyboardShortcut): string {
  return isMac ? shortcut.macKeys : shortcut.windowsKeys;
}
