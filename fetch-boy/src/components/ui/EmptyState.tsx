import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  label: string;
  action?: () => void;
  actionLabel?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, label, action, actionLabel, className }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 text-center${className ? ` ${className}` : ''}`}>
      <Icon className="h-10 w-10 text-gray-500 dark:text-gray-400 mb-3" />
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">{label}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="text-blue-400 hover:text-blue-300 text-sm font-medium cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
