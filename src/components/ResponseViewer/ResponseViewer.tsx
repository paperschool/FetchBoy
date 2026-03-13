import { MonacoEditorField } from '@/components/Editor/MonacoEditorField';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { Download, Send, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { HeadersTable } from '@/components/ui/HeadersTable';
import { ViewerShell } from '@/components/ui/ViewerShell';

export interface ResponseHeaderRow {
  key: string;
  value: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  responseTimeMs: number;
  responseSizeBytes: number;
  body: string;  // base64 encoded for binary responses, text for text responses
  headers: ResponseHeaderRow[];
  contentType?: string;  // Content-Type header value from backend
}

export function isImageContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().startsWith('image/');
}

export function isPdfContentType(contentType?: string): boolean {
  return contentType?.toLowerCase() === 'application/pdf';
}

export function isBinaryContentType(contentType?: string): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  return ct.startsWith('image/') || ct === 'application/octet-stream' || ct === 'application/pdf';
}

interface ResponseViewerProps {
  response: ResponseData | null;
  error: string | null;
  logs?: string[];
  onClearLogs?: () => void;
  requestedUrl?: string;
  wasCancelled?: boolean;
  wasTimedOut?: boolean;
  timedOutAfterSec?: number | null;
}

type ResponseTab = 'body' | 'headers' | 'logs';

function getStatusColorClass(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-600';
  if (status >= 400 && status < 500) return 'text-yellow-600';
  if (status >= 500) return 'text-red-600';
  return 'text-app-primary';
}

// Image viewer component with zoom and scroll
export function ImageViewer({ contentType, body }: { contentType?: string; body: string }) {
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageSrc = `data:${contentType};base64,${body}`;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 400));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 25));
  const handleReset = () => { setZoom(100); setPosition({ x: 0, y: 0 }); };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.deltaY < 0 ? handleZoomIn() : handleZoomOut();
    }
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-2 pb-2 border-b border-app-subtle">
        <button type="button" onClick={handleZoomOut} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-app-subtle hover:bg-gray-100 dark:hover:bg-gray-700 text-app-primary" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="text-xs text-app-secondary min-w-[3rem] text-center">{zoom}%</span>
        <button type="button" onClick={handleZoomIn} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-app-subtle hover:bg-gray-100 dark:hover:bg-gray-700 text-app-primary" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button type="button" onClick={handleReset} className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-app-subtle hover:bg-gray-100 dark:hover:bg-gray-700 text-app-primary ml-2" title="Reset view">
          <RotateCcw size={14} />
          Reset
        </button>
        <span className="text-xs text-app-muted ml-auto">Scroll to pan • Ctrl+scroll to zoom</span>
      </div>
      <div className="flex-1 overflow-auto bg-app-main border border-app-subtle rounded-md cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel}>
        <div className="flex items-center justify-center min-h-full p-4" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}>
          <img src={imageSrc} alt="Response image" className="max-w-none rounded-md shadow-lg" style={{ transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }} draggable={false} />
        </div>
      </div>
    </div>
  );
}

export function ResponseViewer({ response, error, logs = [], onClearLogs, requestedUrl, wasCancelled = false, wasTimedOut = false, timedOutAfterSec = null }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>('body');
  const [responseBodyLanguage, setResponseBodyLanguage] = useState<'json' | 'html' | 'xml' | 'plaintext'>('json');
  const editorFontSize = useUiSettingsStore((state) => state.editorFontSize);

  const formattedJsonBody = useMemo(() => {
    if (!response) return null;
    try {
      return JSON.stringify(JSON.parse(response.body) as unknown, null, 2);
    } catch {
      return null;
    }
  }, [response]);

  useEffect(() => {
    if (formattedJsonBody) setResponseBodyLanguage('json');
  }, [formattedJsonBody]);

  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
    { id: 'logs', label: logs.length > 0 ? `Logs (${logs.length})` : 'Logs' },
  ];

  const header = (
    <>
      {response && (
        <div className="space-y-1">
          {requestedUrl && (
            <p className="font-medium text-sm">
              Requested Url:{' '}
              <span className="text-app-muted break-all text-xs">{requestedUrl}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <p className="font-medium">
              Status:{' '}
              <span className={getStatusColorClass(response.status)}>
                {response.status} {response.statusText}
              </span>
            </p>
            <p className="text-app-secondary">Time: {response.responseTimeMs} ms</p>
            <p className="text-app-secondary">Size: {response.responseSizeBytes} bytes</p>
          </div>
        </div>
      )}
      {error && (
        <>
          <p className="text-sm font-medium text-red-600">Request Error</p>
          <p className="text-sm text-red-600">{error}</p>
        </>
      )}
      {wasCancelled && !response && !error && (
        <div className="flex items-center gap-2 text-app-secondary text-sm py-2">
          <X size={14} className="text-app-muted" />
          <span>Request cancelled</span>
        </div>
      )}
      {wasTimedOut && !response && !error && (
        <div className="flex items-center gap-2 text-app-secondary text-sm py-2">
          <X size={14} className="text-app-muted" />
          <span>{timedOutAfterSec !== null ? `Timed out after ${timedOutAfterSec}s` : 'Request timed out'}</span>
        </div>
      )}
    </>
  );

  if (!response && !error && logs.length === 0 && !wasCancelled && !wasTimedOut) {
    return (
      <ViewerShell testId="response-viewer">
        <EmptyState icon={Send} label="Hit Send to see your response" />
      </ViewerShell>
    );
  }

  return (
    <ViewerShell
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={(id) => setActiveTab(id as ResponseTab)}
      header={header}
      testId="response-viewer"
    >
      {activeTab === 'body' && response ? (
        <div className="relative min-h-[220px] flex-1">
          {isImageContentType(response.contentType) && (
            <ImageViewer contentType={response.contentType} body={response.body} />
          )}
          {isPdfContentType(response.contentType) && (
            <div className="p-4 space-y-3">
              <p className="text-app-muted text-sm">PDF response received</p>
              <a href={`data:application/pdf;base64,${response.body}`} download="response.pdf" className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
                <Download size={14} />Download PDF
              </a>
            </div>
          )}
          {isBinaryContentType(response.contentType) && !isImageContentType(response.contentType) && !isPdfContentType(response.contentType) && (
            <div className="p-4 space-y-3">
              <p className="text-app-muted text-sm">Binary file detected ({response.contentType})</p>
              <a href={`data:${response.contentType};base64,${response.body}`} download="response.bin" className="inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600">
                <Download size={14} />Download File
              </a>
            </div>
          )}
          {!isBinaryContentType(response.contentType) && (
            <>
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                <select
                  id="response-body-language"
                  aria-label="Response Body Language"
                  value={responseBodyLanguage}
                  onChange={(event) => setResponseBodyLanguage(event.target.value as 'json' | 'html' | 'xml' | 'plaintext')}
                  className="select-flat border-app-subtle bg-app-main text-app-primary h-8 rounded-md border pl-2 pr-7 text-xs"
                >
                  <option value="json">JSON</option>
                  <option value="html">HTML</option>
                  <option value="xml">XML</option>
                  <option value="plaintext">Raw</option>
                </select>
              </div>
              <MonacoEditorField
                testId="response-body-editor"
                path="response-body"
                language={responseBodyLanguage}
                value={responseBodyLanguage === 'plaintext' ? response.body : (formattedJsonBody ?? response.body)}
                fontSize={editorFontSize}
                height="100%"
                readOnly
              />
            </>
          )}
        </div>
      ) : activeTab === 'body' ? (
        <p className="text-app-muted text-sm">Send a request to see the response body.</p>
      ) : null}

      {activeTab === 'headers' && response ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <HeadersTable headers={response.headers} emptyMessage="No headers returned." />
        </div>
      ) : activeTab === 'headers' ? (
        <p className="text-app-muted text-sm">Send a request to see response headers.</p>
      ) : null}

      {activeTab === 'logs' && (
        <div className="relative min-h-0 flex-1">
          <div className="absolute top-2 right-2 z-10">
            <button type="button" onClick={onClearLogs} className="border-app-subtle text-app-secondary rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
              Clear Logs
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-app-muted text-xs">No logs yet. Click Send to capture runtime details.</p>
          ) : (
            <pre className="bg-app-main text-app-secondary h-full overflow-auto rounded-md p-2 text-xs whitespace-pre-wrap">{logs.join('\n')}</pre>
          )}
        </div>
      )}
    </ViewerShell>
  );
}
