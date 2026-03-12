import React from 'react';

export interface AppTopBarProps {
  title: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Abstract top bar component that provides common layout for both
 * FetchView and InterceptView top bars.
 */
export function AppTopBar({ title, icon, actions, className }: AppTopBarProps) {
  return (
    <header
      data-testid="top-bar"
      className={`bg-app-topbar text-app-inverse col-span-2 flex h-12 items-center justify-between px-4 ${className ?? ''}`}
    >
      <span className="text-lg font-semibold tracking-wide">
        {icon && <span className="mr-2">{icon}</span>}
        {title}
      </span>
      {actions}
    </header>
  );
}
