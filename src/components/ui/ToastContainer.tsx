import { useToastStore, type ToastType } from '@/stores/toastStore';
import { X } from 'lucide-react';

const STYLE: Record<ToastType, string> = {
  error: 'bg-red-900/90 border-red-700 text-red-200',
  warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-200',
  success: 'bg-green-900/90 border-green-700 text-green-200',
};

export function ToastContainer(): React.ReactElement | null {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-2 px-3 py-2 rounded-md border text-xs shadow-lg animate-in slide-in-from-right ${STYLE[toast.type]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
