import type { ReactNode } from 'react'

export interface ViewerTab {
  id: string
  label: string
}

interface ViewerShellProps {
  tabs?: ViewerTab[]
  activeTab?: string
  onTabChange?: (id: string) => void
  header?: ReactNode
  children: ReactNode
  testId?: string
  'data-tour'?: string
}

/**
 * Shared shell for tabbed viewer panels (ResponseViewer, RequestDetailView).
 * Renders the outer section border, optional header, consistent tab bar, and
 * a flex content area. Tab state is controlled by the caller.
 */
export function ViewerShell({
  tabs,
  activeTab,
  onTabChange,
  header,
  children,
  testId,
  'data-tour': dataTour,
}: ViewerShellProps) {
  return (
    <section
      data-testid={testId}
      data-tour={dataTour}
      className="border-app-subtle flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-md border p-3"
    >
      {header}

      {(tabs ?? []).length > 0 && (
        <div className="border-app-subtle border-b">
          <div className="flex gap-2">
            {(tabs ?? []).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange?.(tab.id)}
                className={`rounded-t-md px-3 py-2 text-sm ${
                  activeTab === tab.id
                    ? 'border-app-subtle bg-app-main text-app-primary border border-b-0 font-medium'
                    : 'text-app-muted hover:text-app-primary'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {children}
      </div>
    </section>
  )
}
