import { useState, useEffect } from 'react'
import { Clock, Play, Square, Pencil } from 'lucide-react'
import { useInterceptStore } from '@/stores/interceptStore'
import { RequestEditDialog } from '@/components/Breakpoints/RequestEditDialog'
import { formatHostPath } from './InterceptTable.utils'

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

  const [editOpen, setEditOpen] = useState(false)

  const remaining = useCountdown(pausedRequest?.timeoutAt ?? 0)

  if (pauseState === 'idle' || !pausedRequest) return null

  const { request, breakpointName } = pausedRequest
  const fullUrl = formatHostPath(request.host, request.path)
  const isResuming = pauseState === 'resuming'

  return (
    <>
      <div
        className="p-3 bg-amber-900/20 border border-amber-500/40 rounded-lg mb-2"
        data-testid="paused-request-detail"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-amber-400 font-medium flex items-center gap-2 text-sm">
            <Clock size={16} />
            Request Paused at Breakpoint
          </h3>
          {pausedRequest.timeoutAt > 0 && (
            <span className="text-amber-300 text-xs" data-testid="countdown-timer">
              {remaining}s remaining
            </span>
          )}
        </div>

        {/* Request summary */}
        <div className="mb-3">
          <p className="text-app-inverse font-mono text-xs truncate" title={fullUrl}>
            <span className="font-semibold">{request.method}</span>{' '}
            {fullUrl}
          </p>
          <p className="text-app-muted text-xs mt-0.5">
            Matched breakpoint:{' '}
            <span className="text-amber-400">{breakpointName}</span>
          </p>
          {request.statusCode !== undefined && (
            <p className="text-app-muted text-xs mt-0.5">
              Response status: <span className="text-app-inverse">{request.statusCode}</span>
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
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
            onClick={() => setEditOpen(true)}
            disabled={isResuming}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700/70 hover:bg-blue-600/80 disabled:opacity-50 rounded text-white text-xs font-medium transition-colors"
            title="Edit response before continuing"
          >
            <Pencil size={13} />
            Edit &amp; Continue
          </button>

          {isResuming && (
            <span className="text-app-muted text-xs ml-2">Resuming…</span>
          )}
        </div>
      </div>

      {editOpen && (
        <RequestEditDialog
          request={request}
          onConfirm={(mods) => {
            setEditOpen(false)
            void editAndResume(mods)
          }}
          onCancel={() => setEditOpen(false)}
        />
      )}
    </>
  )
}
