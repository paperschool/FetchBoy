import { useEffect, useRef, useState } from 'react'
import { Clock, Play, Square, Pencil } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'
import { t } from '@/lib/i18n'

function useCountdown(timeoutAt: number): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, timeoutAt - Math.floor(Date.now() / 1000))
  )

  useEffect(() => {
    if (timeoutAt === 0) return // "never" timeout

    const timer = setInterval(() => {
      const secs = Math.max(0, timeoutAt - Math.floor(Date.now() / 1000))
      setRemaining(secs)
      if (secs === 0) clearInterval(timer)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeoutAt])

  return remaining
}

function UrgencyBar({ paused }: { paused: boolean }) {
  const [filled, setFilled] = useState(false)
  const frameRef = useRef(0)

  useEffect(() => {
    if (!paused) { setFilled(false); return }
    frameRef.current = requestAnimationFrame(() => setFilled(true))
    return () => cancelAnimationFrame(frameRef.current)
  }, [paused])

  if (!paused) return null

  return (
    <div className="w-full h-1.5 rounded-full overflow-hidden mb-2 bg-amber-500/20" data-testid="urgency-bar">
      <div
        className={`h-full bg-amber-500 rounded-full transition-all duration-[5000ms] ease-linear ${filled ? 'w-full' : 'w-0'}`}
      />
    </div>
  )
}

export function PausedRequestDetail() {
  const pauseState = useInterceptStore((s) => s.pauseState)
  const pausedRequest = useInterceptStore((s) => s.pausedRequest)
  const continueRequest = useInterceptStore((s) => s.continueRequest)
  const dropRequest = useInterceptStore((s) => s.dropRequest)
  const editAndResume = useInterceptStore((s) => s.editAndResume)
  const editMode = useInterceptStore((s) => s.editMode)
  const enterEditMode = useInterceptStore((s) => s.enterEditMode)

  const remaining = useCountdown(pausedRequest?.timeoutAt ?? 0)

  if (pauseState === 'idle' || !pausedRequest) return null

  const isResuming = pauseState === 'resuming'

  if (editMode) {
    return (
      <div data-testid="paused-request-detail">
        <UrgencyBar paused={pauseState === 'paused'} />
        <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/40 mb-2">
        <span className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
          <Pencil size={12} />
          {t('intercept.editingResponse')}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void dropRequest()}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/70 hover:bg-red-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
            title={t('intercept.dropTooltip')}
          >
            <Square size={13} />
            {t('intercept.drop')}
          </button>
          <button
            type="button"
            onClick={() => void editAndResume()}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/70 hover:bg-green-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
            title={t('intercept.continueTooltip')}
          >
            <Play size={13} />
            {t('intercept.continue')}
          </button>
        </div>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="paused-request-detail">
      <UrgencyBar paused={pauseState === 'paused'} />
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-500/40 mb-2">
      <div className="flex items-center gap-2 text-amber-400 text-xs">
        <Clock size={13} />
        <span className="font-medium">{t('intercept.paused')}</span>
        {pausedRequest.timeoutAt > 0 && (
          <span className="text-amber-300" data-testid="countdown-timer">
            {remaining}s
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void continueRequest()}
          disabled={isResuming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/70 hover:bg-green-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
          title={t('intercept.applyTooltip')}
        >
          <Play size={13} />
          {t('intercept.continue')}
        </button>

        <button
          type="button"
          onClick={() => void dropRequest()}
          disabled={isResuming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/70 hover:bg-red-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
          title={t('intercept.dropTooltip')}
        >
          <Square size={13} />
          {t('intercept.drop')}
        </button>

        <button
          type="button"
          onClick={enterEditMode}
          disabled={isResuming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/70 hover:bg-blue-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
          title={t('intercept.editTooltip')}
        >
          <Pencil size={13} />
          {t('intercept.continueWithEdits')}
        </button>

        {isResuming && (
          <span className="text-app-muted text-xs self-center ml-1">{t('intercept.resuming')}</span>
        )}
      </div>
      </div>
    </div>
  )
}
