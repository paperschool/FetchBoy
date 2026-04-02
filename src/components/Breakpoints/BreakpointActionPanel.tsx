import { Play, Square, Pencil, Clock } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'
import { t } from '@/lib/i18n'

interface Props {
  breakpointId: string
}

export function BreakpointActionPanel({ breakpointId }: Props) {
  const pauseState = useInterceptStore((s) => s.pauseState)
  const pausedRequest = useInterceptStore((s) => s.pausedRequest)
  const continueRequest = useInterceptStore((s) => s.continueRequest)
  const dropRequest = useInterceptStore((s) => s.dropRequest)
  const enterEditMode = useInterceptStore((s) => s.enterEditMode)

  const isPausedForThis =
    pauseState === 'paused' && pausedRequest?.breakpointId === breakpointId

  if (!isPausedForThis) return null

  return (
    <div className="flex items-center gap-2 mt-1 p-1.5 bg-amber-900/20 border border-amber-500/30 rounded">
      <div className="flex items-center gap-1 text-amber-400">
        <Clock size={12} />
        <span className="text-xs">{t('breakpoints.paused')}</span>
      </div>

      <div className="flex gap-1 ml-auto">
        <button
          type="button"
          onClick={() => void continueRequest()}
          className="p-1 bg-green-700/60 hover:bg-green-600/80 rounded text-white transition-colors"
          title={t('breakpoints.continue')}
          aria-label="Continue request"
        >
          <Play size={12} />
        </button>

        <button
          type="button"
          onClick={() => void dropRequest()}
          className="p-1 bg-red-700/60 hover:bg-red-600/80 rounded text-white transition-colors"
          title={t('breakpoints.drop')}
          aria-label="Drop request"
        >
          <Square size={12} />
        </button>

        <button
          type="button"
          onClick={enterEditMode}
          className="p-1 bg-blue-700/60 hover:bg-blue-600/80 rounded text-white transition-colors"
          title={t('breakpoints.continueWithEdits')}
          aria-label="Continue with edits"
        >
          <Pencil size={12} />
        </button>
      </div>
    </div>
  )
}
