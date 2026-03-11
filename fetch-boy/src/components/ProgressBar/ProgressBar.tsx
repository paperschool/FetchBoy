import { useEffect, useState } from 'react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

interface ProgressBarProps {
  isActive: boolean;
  progress: number; // 0-100
  onComplete?: () => void;
}

export function ProgressBar({ isActive, progress, onComplete }: ProgressBarProps) {
  const theme = useUiSettingsStore((s) => s.theme);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
    } else if (progress >= 100) {
      // Fade out after completion
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isActive, progress, onComplete]);

  if (!visible && progress === 0) return null;

  // Determine if dark mode is active
  const isDark = 
    theme === 'dark' || 
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Theme-aware colors
  const progressColor = isDark ? '#3b82f6' : '#2563eb'; // blue-500/600

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-1"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease-out',
        pointerEvents: 'none',
      }}
      role="progressbar"
      aria-valuenow={Math.min(progress, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      data-testid="progress-bar"
    >
      <div
        className="h-full transition-all duration-300 ease-out"
        style={{
          width: `${Math.min(progress, 100)}%`,
          backgroundColor: progressColor,
        }}
      />
    </div>
  );
}
