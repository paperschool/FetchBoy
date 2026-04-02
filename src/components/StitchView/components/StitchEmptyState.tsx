import { Plus } from 'lucide-react';
import { t } from '@/lib/i18n';

interface StitchEmptyStateProps {
  hasChain: boolean;
  onCreateChain: () => void;
}

export function StitchEmptyState({ hasChain, onCreateChain }: StitchEmptyStateProps): React.ReactElement {
  if (hasChain) {
    // Chain is active but has no nodes
    return (
      <div className="flex h-full items-center justify-center" data-testid="empty-canvas">
        <div className="text-center">
          <p className="text-sm text-app-muted">{t('stitch.addNodeToStart')}</p>
        </div>
      </div>
    );
  }

  // No chain selected
  return (
    <div className="flex h-full items-center justify-center" data-testid="empty-no-chain">
      <div className="text-center">
        <h1 className="text-lg font-semibold text-app-primary">
          {t('stitch.chainBuilder')}
        </h1>
        <p className="mt-1 text-sm text-app-muted">
          {t('stitch.selectOrCreate')}
        </p>
        <button
          className="mt-4 inline-flex items-center gap-1.5 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          onClick={onCreateChain}
          data-testid="create-chain-cta"
        >
          <Plus size={14} />
          {t('stitch.createFirstChain')}
        </button>
      </div>
    </div>
  );
}
