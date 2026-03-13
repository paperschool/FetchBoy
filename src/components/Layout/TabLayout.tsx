import React from 'react';

export interface TabLayoutProps {
  topBar: React.ReactNode;
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
  topBar,
  sidebar,
  middleContent,
  mainContent,
  sidebarCollapsed,
  className,
}: TabLayoutProps) {
  // When there's no middleContent, use a simpler 2-row grid
  const gridRows = middleContent ? 'grid-rows-[3rem_2.25rem_1fr]' : 'grid-rows-[3rem_1fr]';
  const mainContentRow = middleContent ? 'row-start-3' : 'row-start-2';
  // Sidebar spans from row 2 to end (not including topBar)
  const sidebarRow = middleContent ? 'row-start-2 row-end-4' : 'row-start-2 row-end-3';

  return (
    <div
      className={`grid h-full ${
        sidebarCollapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]'
      } ${gridRows} overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out ${
        className ?? ''
      }`}
    >
      {topBar}
      <aside className={`${sidebarRow} overflow-hidden`}>
        {sidebar}
      </aside>
      {middleContent && (
        <div className="col-start-2 row-start-2 border-b border-app-subtle bg-app-sidebar overflow-hidden">
          {middleContent}
        </div>
      )}
      <div className={`col-start-2 ${mainContentRow} overflow-hidden`}>
        {mainContent}
      </div>
    </div>
  );
}
