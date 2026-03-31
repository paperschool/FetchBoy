import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { TabLayout } from '@/components/Layout/TabLayout';
import { useStitchStore } from '@/stores/stitchStore';
import { StitchCanvas } from './components/StitchCanvas';
import { StitchEditorPanel } from './components/StitchEditorPanel';
import { StitchDebugLog } from './components/StitchDebugLog';
import { StitchChainOutput } from './components/StitchChainOutput';

export function StitchView(): React.ReactElement {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const chains = useStitchStore((s) => s.chains);
  const activeChainId = useStitchStore((s) => s.activeChainId);
  const selectedNodeId = useStitchStore((s) => s.selectedNodeId);
  const nodes = useStitchStore((s) => s.nodes);
  const loadChains = useStitchStore((s) => s.loadChains);
  const loadChain = useStitchStore((s) => s.loadChain);
  const createChain = useStitchStore((s) => s.createChain);
  const bottomPanel = useStitchStore((s) => s.bottomPanel);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const showEditor = selectedNode !== null && selectedNode.type !== undefined;
  const showDebugLog = !showEditor && bottomPanel === 'debug';
  const showOutput = !showEditor && bottomPanel === 'output';

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

  // Clean up resize listeners if component unmounts mid-drag
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

  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadChains().catch((err) => {
      console.error('Failed to load stitch chains:', err);
      setLoadError('Failed to load chains. The database may be corrupted.');
    });
  }, [loadChains]);

  const handleSelectChain = useCallback(
    (chainId: string): void => {
      loadChain(chainId).catch((err) => {
        console.error('Failed to load chain:', err);
      });
    },
    [loadChain],
  );

  const handleCreateChain = useCallback((): void => {
    const name = `Chain ${chains.length + 1}`;
    createChain(name)
      .then((chain) => loadChain(chain.id))
      .catch(() => {});
  }, [chains.length, createChain, loadChain]);

  return (
    <TabLayout
      sidebarCollapsed={sidebarCollapsed}
      sidebar={
        sidebarCollapsed ? (
          <div className="flex h-full flex-col items-center gap-2 bg-app-sidebar p-2">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="rounded p-2 transition-colors hover:bg-gray-700"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight size={20} className="text-app-muted" />
            </button>
            <button
              className="rounded p-2 text-green-500 transition-colors hover:bg-gray-700"
              onClick={handleCreateChain}
              title="New chain"
              data-testid="new-chain-button"
            >
              <Plus size={20} />
            </button>
          </div>
        ) : (
          <div className="flex h-full flex-col bg-app-sidebar p-3">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="rounded p-1.5 transition-colors hover:bg-gray-700"
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <ChevronLeft size={18} className="text-app-muted" />
              </button>
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Beta
              </span>
            </div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-app-muted">
                Chains
              </h2>
              <button
                className="rounded p-0.5 text-green-500 hover:bg-app-hover"
                onClick={handleCreateChain}
                title="New chain"
                data-testid="new-chain-button"
              >
                <Plus size={14} />
              </button>
            </div>
            {loadError ? (
              <p className="text-xs text-red-500">{loadError}</p>
            ) : chains.length === 0 ? (
              <p className="text-xs text-app-muted">No chains yet</p>
            ) : (
              <ul className="space-y-1">
                {chains.map((chain) => (
                  <li
                    key={chain.id}
                    className={`cursor-pointer truncate rounded px-2 py-1 text-sm ${
                      chain.id === activeChainId
                        ? 'bg-blue-500/10 text-app-primary'
                        : 'text-app-secondary hover:bg-app-hover'
                    }`}
                    onClick={() => handleSelectChain(chain.id)}
                  >
                    {chain.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      }
      mainContent={
        activeChainId ? (
          <div className="flex h-full flex-col">
            <div className={(showEditor || showDebugLog || showOutput) ? 'min-h-0 flex-1' : 'h-full'}>
              <StitchCanvas />
            </div>
            {(showEditor || showDebugLog || showOutput) && (
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
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <h1 className="text-lg font-semibold text-app-primary">
                Stitch — Request Chain Builder
              </h1>
              <p className="mt-1 text-sm text-app-muted">
                Select a chain or create one to get started
              </p>
            </div>
          </div>
        )
      }
    />
  );
}
