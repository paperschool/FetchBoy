import { Clock } from 'lucide-react'

interface Props {
  timeout: number // seconds; 0 = never
  onChange: (seconds: number) => void
}

const TIMEOUT_OPTIONS = [
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 0, label: 'Never' },
]

export function TimeoutConfig({ timeout, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <Clock size={12} className="text-app-muted shrink-0" />
      <span className="text-xs text-app-muted shrink-0">Pause timeout</span>
      <select
        value={timeout}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="select-flat border-app-subtle bg-app-main text-app-primary h-7 rounded-md border pl-2 pr-7 text-xs"
        aria-label="Pause timeout"
      >
        {TIMEOUT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
