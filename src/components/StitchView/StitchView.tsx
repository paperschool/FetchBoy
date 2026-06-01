import { useEffect, useState, useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { open } from '@tauri-apps/plugin-shell';
import { TabLayout } from '@/components/Layout/TabLayout';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchCanvas } from './components/StitchCanvas';
import { StitchEditorPanel } from './components/StitchEditorPanel';
import { StitchDebugLog } from './components/StitchDebugLog';
import { StitchChainOutput } from './components/StitchChainOutput';
import { StitchPreviewPanel } from './components/StitchPreviewPanel';
import { StitchSidebar } from './components/StitchSidebar';
import { StitchEmptyState } from './components/StitchEmptyState';
import { useStitchAutoSave } from './hooks/useStitchAutoSave';

const STITCH_DEV_WARNING_KEY = 'stitch-dev-warning-dismissed';
const FETCHBOY_ISSUES_URL = 'https://github.com/paperschool/FetchBoy/issues';

export function StitchView(): React.ReactElement {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [devWarningDismissed, setDevWarningDismissed] = useState(
    () => localStorage.getItem(STITCH_DEV_WARNING_KEY) === '1',
  );

  const dismissDevWarning = useCallback((): void => {
    localStorage.setItem(STITCH_DEV_WARNING_KEY, '1');
    setDevWarningDismissed(true);
  }, []);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const nodes = useStitchStore((s) => s.nodes);
  const chains = useStitchStore((s) => s.chains);
  const loadChains = useStitchStore((s) => s.loadChains);
  const loadChain = useStitchStore((s) => s.loadChain);
  const createChain = useStitchStore((s) => s.createChain);
  const renameChain = useStitchStore((s) => s.renameChain);
  const bottomPanel = useStitchStore((s) => s.bottomPanel);

  const { saving } = useStitchAutoSave();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const showEditor = selectedNode !== null && selectedNode.type !== undefined;
  const showDebugLog = !showEditor && bottomPanel === 'debug';
  const showOutput = !showEditor && bottomPanel === 'output';
  const showPreview = !showEditor && bottomPanel === 'preview';

  const activeChain = chains.find((c) => c.id === activeChainId);

  const handleClosePanel = useCallback((): void => {
    useStitchStore.setState({ bottomPanel: 'none' });
  }, []);

  const handleCloseAndClear = useCallback((): void => {
    useStitchStore.setState({
      executionLogs: [],
      executionNodeOutputs: {},
      executionError: null,
      executionCurrentNodeId: null,
      executionState: 'idle' as const,
      bottomPanel: 'none',
    });
  }, []);

  const [editorHeight, setEditorHeight] = useState(260);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: editorHeight };
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent): void => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setEditorHeight(Math.max(120, Math.min(600, dragRef.current.startH + delta)));
    };
    const onUp = (): void => {
      dragRef.current = null;
      cleanupRef.current = null;
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    cleanupRef.current = onUp;
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [editorHeight]);

  useEffect(() => {
    loadChains()
      .then(() => {
        const { chains: loaded, activeChainId: active } = useStitchStore.getState();
        if (loaded.length > 0 && !active) {
          loadChain(loaded[0].id).catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Failed to load stitch chains:', err);
      });
  }, [loadChains, loadChain]);

  const handleCreateChain = useCallback((): void => {
    const name = `Chain ${chains.length + 1}`;
    createChain(name)
      .then((chain) => loadChain(chain.id))
      .catch(() => {});
  }, [chains.length, createChain, loadChain]);

  // Header rename state
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerEditValue, setHeaderEditValue] = useState('');
  const headerInputRef = useRef<HTMLInputElement>(null);

  const handleHeaderDoubleClick = useCallback((): void => {
    if (!activeChain) return;
    setHeaderEditValue(activeChain.name);
    setHeaderEditing(true);
    setTimeout(() => headerInputRef.current?.select(), 0);
  }, [activeChain]);

  const handleHeaderCommit = useCallback((): void => {
    setHeaderEditing(false);
    const trimmed = headerEditValue.trim();
    if (activeChainId && trimmed && trimmed !== activeChain?.name) {
      renameChain(activeChainId, trimmed).catch(() => {});
    }
  }, [headerEditValue, activeChainId, activeChain?.name, renameChain]);

  return (
    <div className="flex h-full flex-col">
      {!devWarningDismissed && (
        <div
          data-testid="stitch-dev-warning"
          className="flex shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400"
        >
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1">
            Stitch is still under development — report bugs{" "}
            <button
              onClick={() => void open(FETCHBOY_ISSUES_URL)}
              className="cursor-pointer font-medium underline hover:text-amber-300"
            >
              here
            </button>
            .
          </span>
          <button
            onClick={dismissDevWarning}
            aria-label="Dismiss warning"
            title="Dismiss"
            className="shrink-0 cursor-pointer rounded p-0.5 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <TabLayout
          sidebarCollapsed={sidebarCollapsed}
          sidebar={
            <StitchSidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
            />
          }
          mainContent={
        activeChainId ? (
          <div className="flex h-full flex-col">
            {/* Chain header bar */}
            <div className="flex shrink-0 items-center gap-2 border-b border-app-subtle bg-app-sidebar px-3 py-1">
              {headerEditing ? (
                <input
                  ref={headerInputRef}
                  autoFocus
                  className="min-w-0 flex-1 rounded border border-app-subtle bg-app-main px-1 text-xs font-medium text-app-primary outline-none"
                  value={headerEditValue}
                  onChange={(e) => setHeaderEditValue(e.target.value)}
                  onBlur={handleHeaderCommit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleHeaderCommit();
                    if (e.key === 'Escape') setHeaderEditing(false);
                  }}
                  data-testid="header-rename-input"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate text-xs font-medium text-app-primary cursor-text"
                  onDoubleClick={handleHeaderDoubleClick}
                  title="Double-click to rename"
                  data-testid="chain-header-name"
                >
                  {activeChain?.name ?? 'Untitled'}
                </span>
              )}
              {saving && (
                <span className="text-[10px] text-app-muted" data-testid="save-indicator">Saving...</span>
              )}
            </div>

            <div className={(showEditor || showDebugLog || showOutput || showPreview) ? 'min-h-0 flex-1' : 'h-full'}>
              <StitchCanvas />
            </div>
            {(showEditor || showDebugLog || showOutput || showPreview) && (
              <>
                <div
                  className="shrink-0 cursor-row-resize border-t border-app-subtle bg-app-sidebar hover:bg-blue-500/20 active:bg-blue-500/30"
                  style={{ height: 5 }}
                  onPointerDown={handleResizePointerDown}
                  title="Drag to resize"
                  data-testid="panel-resize-handle"
                />
                <div className="shrink-0 overflow-hidden transition-[height] duration-150" style={{ height: editorHeight }}>
                  {showEditor && selectedNode && <StitchEditorPanel node={selectedNode} />}
                  {showDebugLog && <StitchDebugLog onClose={handleCloseAndClear} />}
                  {showOutput && <StitchChainOutput onClose={handleClosePanel} />}
                  {showPreview && <StitchPreviewPanel />}
                </div>
              </>
            )}
          </div>
        ) : (
          <StitchEmptyState hasChain={false} onCreateChain={handleCreateChain} />
        )
          }
        />
      </div>
    </div>
  );
}
