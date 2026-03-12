import { useInterceptStore } from '@/stores/interceptStore'
import {
  columnDefs,
  formatTimestamp,
  formatMethod,
  formatHostPath,
  formatStatusCode,
  formatContentType,
  formatSize,
} from './InterceptTable.utils'

export function InterceptTable() {
  const requests = useInterceptStore((state) => state.requests)

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0 bg-app-main">
          <tr className="border-b border-app-subtle">
            {columnDefs.map((col) => (
              <th
                key={col.id}
                className="px-3 py-2 text-left text-xs font-medium text-app-secondary uppercase"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="border-b border-app-subtle hover:bg-app-subtle">
              <td className="px-3 py-2 text-xs text-app-muted">
                {formatTimestamp(req.timestamp)}
              </td>
              <td className="px-3 py-2">
                {formatMethod(req.method)}
              </td>
              <td className="px-3 py-2 text-xs text-app-primary">
                {formatHostPath(req.host, req.path)}
              </td>
              <td className="px-3 py-2">
                {formatStatusCode(req.statusCode)}
              </td>
              <td className="px-3 py-2 text-xs text-app-muted">
                {formatContentType(req.contentType)}
              </td>
              <td className="px-3 py-2 text-xs text-app-muted">
                {formatSize(req.size)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
