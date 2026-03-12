import { Shield } from 'lucide-react'

export function InterceptView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-app-main text-center">
      <Shield className="h-12 w-12 text-app-muted" />
      <h2 className="text-base font-semibold text-app-primary">Traffic Intercept</h2>
      <p className="text-sm text-app-muted">Start the proxy to see requests here.</p>
    </div>
  )
}
