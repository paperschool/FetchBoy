import { useState } from 'react';
import { X, FileUp, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { parsePostmanV21 } from '@/lib/importers/postmanV21';
import { parseInsomniaV4 } from '@/lib/importers/insomniaV4';
import { persistImportResult } from '@/lib/importers/persist';
import { useCollectionStore } from '@/stores/collectionStore';
import type { VendorType, ImportResult } from '@/lib/importers/types';

type WizardStep = 'vendor' | 'file' | 'preview' | 'importing' | 'done' | 'error';

interface ImportWizardProps { isOpen: boolean; onClose: () => void }

export function ImportWizard({ isOpen, onClose }: ImportWizardProps): React.ReactElement | null {
  const [step, setStep] = useState<WizardStep>('vendor');
  const [vendor, setVendor] = useState<VendorType>('postman');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState({ folders: 0, requests: 0 });
  const store = useCollectionStore();

  if (!isOpen) return null;

  const reset = (): void => {
    setStep('vendor');
    setVendor('postman');
    setResult(null);
    setError(null);
    onClose();
  };

  const handleFileSelect = async (): Promise<void> => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!selected) return;
      const path = typeof selected === 'string' ? selected : selected[0];
      const text = await readTextFile(path);

      const parsed = vendor === 'postman' ? parsePostmanV21(text) : parseInsomniaV4(text);
      setResult(parsed);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!result) return;
    setStep('importing');
    try {
      const { collection, folders, requests } = await persistImportResult(result);
      store.addCollection(collection);
      for (const f of folders) store.addFolder(f);
      for (const r of requests) store.addRequest(r);
      setImportedCount({ folders: folders.length, requests: requests.length });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  };

  const methodCounts = result?.requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.method] = (acc[r.method] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={reset}>
      <div className="bg-app-surface border-app-subtle w-[28rem] rounded-lg border shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-app-primary">Import Collection</h2>
          <button onClick={reset} className="text-app-muted hover:text-app-primary cursor-pointer"><X size={16} /></button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Step 1: Vendor select */}
          {step === 'vendor' && (
            <>
              <p className="text-xs text-app-muted">Select the tool you exported from:</p>
              <div className="flex gap-2">
                {(['postman', 'insomnia'] as VendorType[]).map((v) => (
                  <button key={v} onClick={() => setVendor(v)}
                    className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${vendor === v ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-app-subtle text-app-muted hover:text-app-primary'}`}>
                    {v === 'postman' ? 'Postman (v2.1)' : 'Insomnia (v4)'}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setStep('file')} className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer">Next</button>
              </div>
            </>
          )}

          {/* Step 2: File select */}
          {step === 'file' && (
            <>
              <p className="text-xs text-app-muted">Select the exported JSON file from {vendor === 'postman' ? 'Postman' : 'Insomnia'}:</p>
              <button onClick={() => void handleFileSelect()} className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-app-subtle py-6 text-sm text-app-muted hover:text-app-primary hover:border-blue-500/50 cursor-pointer transition-colors">
                <FileUp size={18} /> Choose File...
              </button>
              <div className="flex justify-between">
                <button onClick={() => setStep('vendor')} className="text-xs text-app-muted hover:text-app-primary cursor-pointer">Back</button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && result && (
            <>
              <p className="text-xs text-app-muted">Review what will be imported:</p>
              <div className="space-y-2 rounded-md border border-app-subtle p-3 text-xs">
                <p className="font-medium text-app-primary">{result.collection.name}</p>
                <p className="text-app-muted">{result.folders.length} folder(s), {result.requests.length} request(s)</p>
                {methodCounts && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(methodCounts).map(([m, c]) => (
                      <span key={m} className="rounded bg-app-subtle/30 px-1.5 py-0.5 text-app-secondary">{m}: {c}</span>
                    ))}
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-app-subtle pt-2">
                    {result.warnings.map((w, i) => (
                      <p key={i} className="flex items-start gap-1 text-amber-400">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep('file')} className="text-xs text-app-muted hover:text-app-primary cursor-pointer">Back</button>
                <button onClick={() => void handleImport()} className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 cursor-pointer">Import</button>
              </div>
            </>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <p className="text-xs text-app-muted">Importing collection...</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 size={24} className="text-green-400" />
              <p className="text-sm font-medium text-app-primary">Import complete!</p>
              <p className="text-xs text-app-muted">{importedCount.folders} folder(s), {importedCount.requests} request(s) imported</p>
              <button onClick={reset} className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer">Done</button>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertTriangle size={24} className="text-red-400" />
              <p className="text-sm font-medium text-red-400">Import failed</p>
              <p className="text-xs text-app-muted text-center">{error}</p>
              <button onClick={() => { setError(null); setStep('file'); }} className="mt-2 rounded-md border border-app-subtle px-4 py-1.5 text-xs text-app-primary cursor-pointer">Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
