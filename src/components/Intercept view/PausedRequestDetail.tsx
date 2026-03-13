import { useEffect, useState } from 'react'
import { Clock, Play, Square, Pencil } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'

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
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-amber-500/40 mb-2"
        data-testid="paused-request-detail"
      >
        <span className="text-amber-400 text-xs font-medium flex items-center gap-1.5">
          <Pencil size={12} />
          Editing response — changes will be sent to client
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void dropRequest()}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/70 hover:bg-red-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
            title="Drop this response (client receives 502)"
          >
            <Square size={13} />
            Drop
          </button>
          <button
            type="button"
            onClick={() => void editAndResume()}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700/70 hover:bg-green-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
            title="Send edited response to client"
          >
            <Play size={13} />
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-amber-500/40 mb-2"
      data-testid="paused-request-detail"
    >
      <div className="flex items-center gap-2 text-amber-400 text-xs">
        <Clock size={13} />
        <span className="font-medium">Paused</span>
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
          title="Apply breakpoint modifications and send response to client"
        >
          <Play size={13} />
          Continue
        </button>

        <button
          type="button"
          onClick={() => void dropRequest()}
          disabled={isResuming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700/70 hover:bg-red-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
          title="Drop this response (client receives 502)"
        >
          <Square size={13} />
          Drop
        </button>

        <button
          type="button"
          onClick={enterEditMode}
          disabled={isResuming}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/70 hover:bg-blue-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
          title="Edit response before continuing"
        >
          <Pencil size={13} />
          Continue with Edits
        </button>

        {isResuming && (
          <span className="text-app-muted text-xs self-center ml-1">Resuming…</span>
        )}
      </div>
    </div>
  )
}
