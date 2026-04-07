import { Code, Workflow } from 'lucide-react';
import { t } from '@/lib/i18n';

interface PreRequestModeChooserProps {
  onChooseJavaScript: () => void;
  onChooseChain: () => void;
}

export function PreRequestModeChooser({
  onChooseJavaScript,
  onChooseChain,
}: PreRequestModeChooserProps): React.ReactElement {
  return (
    <div className="flex flex-1 items-center justify-center" data-testid="pre-request-mode-chooser">
      <div className="flex w-full max-w-md items-stretch rounded-lg border border-app-subtle bg-app-sidebar">
        {/* JavaScript option */}
        <button
          type="button"
          onClick={onChooseJavaScript}
          className="flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-l-lg p-6 transition-colors hover:bg-app-hover"
          data-testid="choose-javascript"
        >
          <Code size={28} className="text-amber-400" />
          <span className="text-sm font-medium text-app-primary">{t('fetch.useJavaScript')}</span>
          <span className="text-[10px] text-app-muted">{t('fetch.useJavaScriptDesc')}</span>
        </button>

        {/* Divider */}
        <div className="w-px bg-app-subtle" />

        {/* Chain option */}
        <button
          type="button"
          onClick={onChooseChain}
          className="flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-r-lg p-6 transition-colors hover:bg-app-hover"
          data-testid="choose-chain"
        >
          <Workflow size={28} className="text-teal-400" />
          <span className="text-sm font-medium text-app-primary">{t('fetch.useChain')}</span>
          <span className="text-[10px] text-app-muted">{t('fetch.useChainDesc')}</span>
        </button>
      </div>
    </div>
  );
}
