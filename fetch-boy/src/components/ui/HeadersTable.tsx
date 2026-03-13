interface HeadersTableProps {
  headers: Array<{ key: string; value: string }>
  emptyMessage?: string
}

export function HeadersTable({ headers, emptyMessage = 'No headers' }: HeadersTableProps) {
  if (headers.length === 0) {
    return <p className="text-app-muted text-sm">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2">
      {headers.map((header, index) => (
        <div
          key={`${header.key}-${index}`}
          className="border-app-subtle grid grid-cols-[minmax(140px,_220px)_1fr] gap-2 rounded-md border p-2"
        >
          <p className="text-app-secondary text-sm font-medium">{header.key}</p>
          <p className="text-app-primary text-sm break-all">{header.value}</p>
        </div>
      ))}
    </div>
  )
}
