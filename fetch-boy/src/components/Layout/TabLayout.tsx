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
  return (
    <div
      className={`grid h-full ${
        sidebarCollapsed ? 'grid-cols-[3.5rem_1fr]' : 'grid-cols-[16rem_1fr]'
      } grid-rows-[3rem_2.25rem_1fr] overflow-hidden transition-[grid-template-columns] duration-200 ease-in-out [&>aside]:row-span-2 [&>main]:col-start-2 [&>main]:row-start-3 ${
        className ?? ''
      }`}
    >
      {topBar}
      {sidebar}
      {middleContent && (
        <div className="col-start-2 row-start-2 border-b border-app-subtle bg-app-sidebar overflow-hidden">
          {middleContent}
        </div>
      )}
      {mainContent}
    </div>
  );
}
