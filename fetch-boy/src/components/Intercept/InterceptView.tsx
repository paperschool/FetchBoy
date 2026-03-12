import { Shield } from 'lucide-react'
import { InterceptTable } from './InterceptTable'
import { useInterceptStore } from '@/stores/interceptStore'

export function InterceptView() {
  const requests = useInterceptStore((state) => state.requests)

  return (
    <div className="flex h-full flex-col">
      <header className="bg-app-topbar text-app-inverse flex h-12 shrink-0 items-center px-4">
        <span className="text-lg font-semibold tracking-wide">Intercept Boy 🛡️</span>
      </header>
      {requests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-app-main text-center">
          <Shield className="h-12 w-12 text-app-muted" />
          <h2 className="text-base font-semibold text-app-primary">Traffic Intercept</h2>
          <p className="text-sm text-app-muted">Start the proxy to see requests here.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden bg-app-main">
          <InterceptTable />
        </div>
      )}
    </div>
  )
}
