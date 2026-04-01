import { useRef, useMemo, useState, useCallback, useEffect, useDeferredValue } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Trash2 } from "lucide-react";
import { useInterceptStore } from "@/stores/interceptStore";
import { useBreakpointsStore } from "@/stores/breakpointsStore";
import { useMappingsStore } from "@/stores/mappingsStore";
import { createBreakpoint } from "@/lib/breakpoints";
import { createMapping } from "@/lib/mappings";
import { SaveBreakpointDialog } from "@/components/SaveBreakpointDialog/SaveBreakpointDialog";
import { SaveMappingDialog } from "@/components/SaveMappingDialog/SaveMappingDialog";
import {
  columnDefs,
  formatTimestamp,
  formatMethod,
  formatHostPath,
  formatStatusCode,
  formatContentType,
  formatSize,
  filterRequests,
  HTTP_VERBS,
  STATUS_FILTERS,
  CopyButton,
} from "./InterceptTable.utils";
import { openInFetch } from "./openInFetch";
import type { InterceptRequest } from "@/stores/interceptStore";

function deriveBreakpointName(req: InterceptRequest): string {
  // Use the last non-empty path segment, falling back to host
  const segments = req.path.split("/").filter(Boolean);
  const last = segments[segments.length - 1];
  if (last && !/^\d+$/.test(last)) return last;
  if (segments.length >= 2) return segments.slice(-2).join("/");
  return req.host;
}

export function InterceptTable() {
  const {
    requests: liveRequests,
    clearRequests,
    selectedRequestId,
    setSelectedRequestId,
    searchQuery,
    searchMode,
    verbFilter,
    statusFilter,
    setSearchQuery,
    setSearchMode,
    setVerbFilter,
    setStatusFilter,
  } = useInterceptStore();

  // Defer request list updates so rapid traffic doesn't block user interactions
  const requests = useDeferredValue(liveRequests);

  const { addBreakpoint, startEditing: startBpEditing } = useBreakpointsStore();
  const { startEditing: startMapEditing } = useMappingsStore();
  const [breakDialogReq, setBreakDialogReq] = useState<InterceptRequest | null>(null);
  const [mapDialogReq, setMapDialogReq] = useState<InterceptRequest | null>(null);

  const handleBreakClick = useCallback(
    (e: React.MouseEvent, req: InterceptRequest) => {
      e.stopPropagation();
      setBreakDialogReq(req);
    },
    [],
  );

  const handleMapClick = useCallback(
    (e: React.MouseEvent, req: InterceptRequest) => {
      e.stopPropagation();
      setMapDialogReq(req);
    },
    [],
  );

  const handleBreakSave = useCallback(
    async (name: string, urlPattern: string, folderId: string | null) => {
      const bp = await createBreakpoint(folderId, name, urlPattern, "partial");
      addBreakpoint(bp);
      startBpEditing(bp, folderId);
      setBreakDialogReq(null);
    },
    [addBreakpoint, startBpEditing],
  );

  const handleMapSave = useCallback(
    async (name: string, urlPattern: string, folderId: string | null) => {
      const mapping = await createMapping(folderId, name, urlPattern, "partial");
      useMappingsStore.getState().loadAll(
        useMappingsStore.getState().folders,
        [...useMappingsStore.getState().mappings, mapping],
      );
      startMapEditing(mapping, folderId);
      setMapDialogReq(null);
    },
    [startMapEditing],
  );

  const hasItems = Array.isArray(requests) && requests.length > 0;

  const filteredRequests = useMemo(
    () =>
      filterRequests(requests, {
        searchQuery,
        searchMode,
        verbFilter,
        statusFilter,
      }),
    [requests, searchQuery, searchMode, verbFilter, statusFilter],
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setIsTablet(entry.contentRect.width < 768);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredRequests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
    getItemKey: (index) => filteredRequests[index]?.id ?? index,
  });

  // Debounced re-measure: only trigger after filtered data stabilises,
  // not on every rapid-fire update from high-traffic proxy events.
  const prevCountRef = useRef(filteredRequests.length);
  useEffect(() => {
    if (prevCountRef.current === filteredRequests.length) return;
    prevCountRef.current = filteredRequests.length;
    const id = setTimeout(() => rowVirtualizer.measure(), 50);
    return () => clearTimeout(id);
  }, [filteredRequests.length, rowVirtualizer]);

  return (
    <div
      ref={tableContainerRef}
      className="h-full flex flex-col min-h-0"
      data-testid="intercept-table-container"
    >
      {/* Control bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-app-main border-b border-app-subtle shrink-0">
        <span className="text-xs text-app-muted">
          {hasItems
            ? `${filteredRequests.length} of ${requests.length} request${requests.length !== 1 ? "s" : ""}`
            : "No requests"}
        </span>
        {hasItems && (
          <button
            onClick={clearRequests}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-app-muted hover:text-red-400 hover:bg-app-subtle rounded transition-colors cursor-pointer"
            title="Clear all requests"
          >
            <Trash2 size={14} />
            Clear
          </button>
        )}
      </div>

      {/* Filter bar */}
      <div
        data-tour="intercept-search"
        className="flex items-center gap-2 px-3 py-1.5 bg-app-main border-b border-app-subtle shrink-0"
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={searchMode === "regex" ? "Regex filter..." : "Search..."}
          className="flex-1 bg-app-subtle border border-app-subtle rounded px-2 py-1 text-xs text-app-primary placeholder:text-app-muted outline-none focus:border-blue-500/50"
          aria-label="Search requests"
        />
        <button
          onClick={() =>
            setSearchMode(searchMode === "fuzzy" ? "regex" : "fuzzy")
          }
          className={`px-1.5 py-1 text-xs rounded transition-colors ${searchMode === "regex" ? "bg-blue-500/20 text-blue-400" : "text-app-muted hover:bg-app-subtle"}`}
          title="Toggle regex mode"
          aria-label="Toggle regex mode"
        >
          .*
        </button>
        <select
          value={verbFilter ?? ""}
          onChange={(e) => setVerbFilter(e.target.value || null)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
          aria-label="Filter by method"
        >
          <option value="">All methods</option>
          {HTTP_VERBS.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={statusFilter ?? ""}
          onChange={(e) => setStatusFilter(e.target.value || null)}
          className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {hasItems && filteredRequests.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
          No requests match filters
        </div>
      )}

      {filteredRequests.length > 0 && (
        <>
          {/* Header */}
          <div className="w-full flex-shrink-0">
            <div className="flex bg-app-main border-b border-app-subtle">
              {columnDefs
                .filter((col) => {
                  if (isTablet && (col.id === 'contentType' || col.id === 'size' || col.id === 'timestamp')) return false;
                  return true;
                })
                .map((col) => (
                  <div
                    key={col.id}
                    className={`px-2 py-1.5 text-left text-xs font-medium text-app-secondary uppercase ${col.className}`}
                  >
                    {col.label}
                  </div>
                ))}
            </div>
          </div>

          {/* Virtualized body */}
          <div
            ref={parentRef}
            data-tour="intercept-request-table"
            className="flex-1 overflow-auto h-0"
          >
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const req = filteredRequests[virtualRow.index];
                // Guard: virtualizer count can lag one frame behind the array during rapid updates
                if (!req) return null;
                const fullUrl = formatHostPath(req.host, req.path);
                const isSelected = req.id === selectedRequestId;
                return (
                  <div
                    key={req.id}
                    className={`group absolute w-full flex items-center border-b border-app-subtle transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-blue-500/10 border-l-2 border-l-blue-500"
                        : "hover:bg-app-subtle"
                    }`}
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => setSelectedRequestId(req.id)}
                  >
                    {/* Timestamp */}
                    {!isTablet && (
                      <div className="px-2 text-xs text-app-muted w-[100px] shrink-0 tabular-nums">
                        {formatTimestamp(req.timestamp)}
                      </div>
                    )}
                    {/* Host + Path — dominant column */}
                    <div className="px-2 text-xs text-app-primary flex-1 min-w-0 flex items-center gap-1 overflow-hidden">
                      <span className="truncate" title={fullUrl}>
                        {fullUrl}
                      </span>
                      <CopyButton text={fullUrl} />
                    </div>
                    {/* Controls */}
                    <div className="px-1 w-[130px] shrink-0 flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openInFetch(req);
                        }}
                        className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all cursor-pointer"
                        title="Open in Fetch tab"
                      >
                        Fetch
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleMapClick(e, req)}
                        className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-all cursor-pointer"
                        title="Save as mapping"
                      >
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleBreakClick(e, req)}
                        className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all cursor-pointer"
                        title="Save as breakpoint"
                      >
                        Break
                      </button>
                    </div>
                    {/* Method */}
                    <div className="px-2 w-[75px] shrink-0">
                      {formatMethod(req.method)}
                    </div>
                    {/* Status */}
                    <div className="px-2 w-[70px] shrink-0 text-xs tabular-nums">
                      {formatStatusCode(req.statusCode, req.isPending)}
                    </div>
                    {/* Content-Type */}
                    {!isTablet && (
                      <div className="px-2 w-[100px] shrink-0 text-xs text-app-muted overflow-hidden">
                        <span
                          className="truncate block"
                          title={req.contentType || ""}
                        >
                          {formatContentType(req.contentType)}
                        </span>
                      </div>
                    )}
                    {/* Size */}
                    {!isTablet && (
                      <div className="px-2 w-[70px] shrink-0 text-xs text-app-muted tabular-nums">
                        {formatSize(req.size)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!hasItems && (
        <div className="flex-1 flex items-center justify-center text-app-muted">
          No intercepted requests yet
        </div>
      )}

      <SaveBreakpointDialog
        open={breakDialogReq !== null}
        onClose={() => setBreakDialogReq(null)}
        onSave={handleBreakSave}
        defaultName={breakDialogReq ? deriveBreakpointName(breakDialogReq) : ""}
        defaultUrlPattern={
          breakDialogReq
            ? formatHostPath(breakDialogReq.host, breakDialogReq.path)
            : ""
        }
      />
      <SaveMappingDialog
        open={mapDialogReq !== null}
        onClose={() => setMapDialogReq(null)}
        onSave={handleMapSave}
        defaultName={mapDialogReq ? deriveBreakpointName(mapDialogReq) : ""}
        defaultUrlPattern={
          mapDialogReq
            ? formatHostPath(mapDialogReq.host, mapDialogReq.path)
            : ""
        }
      />
    </div>
  );
}
