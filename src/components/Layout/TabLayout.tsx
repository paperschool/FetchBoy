import React from 'react';

export interface TabLayoutProps {
  sidebar: React.ReactNode;
  middleContent?: React.ReactNode;
  mainContent: React.ReactNode;
  sidebarCollapsed: boolean;
  className?: string;
}

/**
 * Abstract tab layout component that provides the common grid layout
 * pattern for both FetchView and InterceptView.
 */
export function TabLayout({
  sidebar,
  middleContent,
  mainContent,
  sidebarCollapsed,
  className,
}: TabLayoutProps) {
  const gridRows = middleContent ? 'grid-rows-[2.25rem_1fr]' : 'grid-rows-[1fr]';
  const mainContentRow = middleContent ? 'row-start-2' : 'row-start-1';
  const sidebarRow = middleContent ? 'row-start-1 row-end-3' : 'row-start-1 row-end-2';

  return (
    <div
      className={`grid h-full ${
        sidebarCollapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]'
      } ${gridRows} overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out ${
        className ?? ''
      }`}
    >
      <aside className={`${sidebarRow} overflow-hidden`}>
        {sidebar}
      </aside>
      {middleContent && (
        <div className="col-start-2 row-start-1 border-b border-app-subtle bg-app-sidebar overflow-hidden">
          {middleContent}
        </div>
      )}
      <div className={`col-start-2 ${mainContentRow} overflow-hidden`}>
        {mainContent}
      </div>
    </div>
  );
}
