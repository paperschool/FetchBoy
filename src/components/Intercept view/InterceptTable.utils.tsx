import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { InterceptRequest } from "@/stores/interceptStore";

export interface ColumnDef {
  id: string;
  label: string;
  className: string;
}

export const columnDefs: ColumnDef[] = [
  { id: "timestamp", label: "Time", className: "w-[82px] shrink-0" },
  { id: "hostPath", label: "Host + Path", className: "flex-1 min-w-0" },
  { id: "controls", label: "", className: "w-[76px] shrink-0" },
  { id: "method", label: "Method", className: "w-[70px] shrink-0" },
  { id: "statusCode", label: "Status", className: "w-[70px] shrink-0" },
  { id: "contentType", label: "Type", className: "w-[100px] shrink-0" },
  { id: "size", label: "Size", className: "w-[70px] shrink-0" },
];

export function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/20 text-green-400",
  POST: "bg-blue-500/20 text-blue-400",
  PUT: "bg-orange-500/20 text-orange-400",
  PATCH: "bg-yellow-500/20 text-yellow-400",
  DELETE: "bg-red-500/20 text-red-400",
  HEAD: "bg-gray-500/20 text-gray-400",
  OPTIONS: "bg-purple-500/20 text-purple-400",
};

export function formatMethod(method: string): React.ReactElement {
  const colorClass =
    METHOD_COLORS[method.toUpperCase()] ?? "bg-gray-500/20 text-gray-400";
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${colorClass}`}>
      {method}
    </span>
  );
}

export function formatHostPath(host: string, path: string): string {
  const hasProtocol = host.startsWith('http://') || host.startsWith('https://');
  return hasProtocol ? `${host}${path}` : `https://${host}${path}`;
}

export function formatStatusCode(statusCode?: number): React.ReactElement {
  if (!statusCode) return <span className="text-app-muted">—</span>;
  let colorClass = "text-app-muted";
  if (statusCode >= 200 && statusCode < 300) colorClass = "text-green-400";
  else if (statusCode >= 300 && statusCode < 400) colorClass = "text-blue-400";
  else if (statusCode >= 400 && statusCode < 500)
    colorClass = "text-orange-400";
  else if (statusCode >= 500) colorClass = "text-red-400";
  return <span className={colorClass}>{statusCode}</span>;
}

export function formatContentType(contentType?: string): string {
  if (!contentType) return "—";
  // Strip parameters (e.g. "application/json; charset=utf-8" → "application/json")
  return contentType.split(";")[0].trim();
}

export function formatSize(size?: number): string {
  if (size === undefined || size === null) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-1 p-0.5 hover:bg-app-subtle rounded transition-colors  cursor-pointer"
      title="Copy URL"
    >
      {copied ? (
        <Check size={12} className="text-green-400" />
      ) : (
        <Copy size={12} className="text-app-muted" />
      )}
    </button>
  );
}

export const HTTP_VERBS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

export const STATUS_FILTERS = [
  { value: "2xx", label: "2xx Success" },
  { value: "3xx", label: "3xx Redirect" },
  { value: "4xx", label: "4xx Client Error" },
  { value: "5xx", label: "5xx Server Error" },
];

export interface FilterOptions {
  searchQuery: string;
  searchMode: "fuzzy" | "regex";
  verbFilter: string | null;
  statusFilter: string | null;
}

export function filterRequests(
  requests: InterceptRequest[],
  { searchQuery, searchMode, verbFilter, statusFilter }: FilterOptions,
): InterceptRequest[] {
  return requests.filter((req) => {
    // Verb filter
    if (verbFilter && req.method.toUpperCase() !== verbFilter) return false;

    // Status filter
    if (statusFilter) {
      const code = req.statusCode ?? 0;
      if (statusFilter === "2xx" && !(code >= 200 && code < 300)) return false;
      if (statusFilter === "3xx" && !(code >= 300 && code < 400)) return false;
      if (statusFilter === "4xx" && !(code >= 400 && code < 500)) return false;
      if (statusFilter === "5xx" && !(code >= 500)) return false;
      if (
        !["2xx", "3xx", "4xx", "5xx"].includes(statusFilter) &&
        String(code) !== statusFilter
      )
        return false;
    }

    // Search filter
    if (searchQuery) {
      const haystack =
        `${req.method} ${formatHostPath(req.host, req.path)} ${req.statusCode ?? ""}`.toLowerCase();
      if (searchMode === "regex") {
        try {
          return new RegExp(searchQuery, "i").test(haystack);
        } catch {
          return false; // invalid regex → show nothing
        }
      }
      return haystack.includes(searchQuery.toLowerCase());
    }

    return true;
  });
}
