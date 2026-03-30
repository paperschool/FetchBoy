import { useState } from "react";
import {
  X,
  FileUp,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Globe,
  Bot,
  Check,
  ClipboardCopy,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { parsePostmanV21 } from "@/lib/importers/postmanV21";
import { parsePostmanV1 } from "@/lib/importers/postmanV1";
import { parseInsomniaV4 } from "@/lib/importers/insomniaV4";
import { persistImportResult } from "@/lib/importers/persist";
import { importCollectionFromJson } from "@/lib/importExport";
import { useCollectionStore } from "@/stores/collectionStore";
import { useEnvironmentStore } from "@/stores/environmentStore";
import { useDebugStore } from "@/stores/debugStore";
import type { ImportFormat, ImportResult } from "@/lib/importers/types";
import collectionPrompt from "../../../Collection-Generation-Prompt.md?raw";

function emitDebug(
  level: "info" | "warn" | "error",
  source: string,
  message: string,
): void {
  useDebugStore.getState().addInternalEvent({
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    level,
    source,
    message,
  });
}

type WizardStep =
  | "format"
  | "file"
  | "preview"
  | "importing"
  | "done"
  | "error";
type SelectedFormat = ImportFormat | "fetchboy-v1";

interface ImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const FORMAT_LABEL: Record<SelectedFormat, string> = {
  "postman-v1": "v1 (Legacy)",
  "postman-v2": "v2.0 / v2.1",
  "insomnia-v4": "v4",
  "fetchboy-v1": "v1",
};

function parseByFormat(text: string, format: ImportFormat): ImportResult {
  switch (format) {
    case "postman-v1":
      return parsePostmanV1(text);
    case "postman-v2":
      return parsePostmanV21(text);
    case "insomnia-v4":
      return parseInsomniaV4(text);
  }
}

function CopyPromptFooter(): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(collectionPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <Bot size={18} className="text-blue-400 shrink-0" />
      <p className="flex-1 min-w-0 text-xs text-app-muted">
        Copy the prompt below into an AI assistant along with an API reference
        to generate a Fetchboy Collection, then import.
      </p>
      <button
        onClick={() => void handleCopy()}
        className="shrink-0 inline-flex items-center gap-1.5 rounded border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/60 cursor-pointer transition-colors"
      >
        {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
        {copied ? "Copied!" : "Copy Prompt"}
      </button>
    </div>
  );
}

export function ImportWizard({
  isOpen,
  onClose,
}: ImportWizardProps): React.ReactElement | null {
  const [step, setStep] = useState<WizardStep>("format");
  const [format, setFormat] = useState<SelectedFormat | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState({
    folders: 0,
    requests: 0,
    environments: 0,
  });
  const collectionStore = useCollectionStore();
  const envStore = useEnvironmentStore();

  if (!isOpen) return null;

  const reset = (): void => {
    setStep("format");
    setFormat(null);
    setResult(null);
    setError(null);
    onClose();
  };

  const selectFormat = (f: SelectedFormat): void => {
    setFormat(f);
    setStep("file");
  };

  const handleFileSelect = async (): Promise<void> => {
    if (!format) return;
    emitDebug("info", "import-wizard", `Selecting file for format: ${format}`);

    // FetchBoy native import — skips preview, imports directly
    if (format === "fetchboy-v1") {
      try {
        const selected = await open({
          multiple: false,
          filters: [
            { name: "FetchBoy Collection", extensions: ["fetchboy"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });
        if (!selected) {
          emitDebug("info", "import-wizard", "File dialog cancelled");
          return;
        }
        const path = typeof selected === "string" ? selected : selected[0];
        emitDebug("info", "import-wizard", `File selected: ${path}`);
        const text = await readTextFile(path);
        emitDebug(
          "info",
          "import-wizard",
          `File read OK (${text.length} chars) — importing as FetchBoy v1`,
        );
        setStep("importing");
        const { collection, folders, requests, environment } =
          await importCollectionFromJson(text);
        emitDebug("info", "import-wizard", `Persisted to DB — updating stores`);
        collectionStore.addCollection(collection);
        for (const f of folders) collectionStore.addFolder(f);
        for (const r of requests) collectionStore.addRequest(r);
        if (environment) envStore.addEnvironment(environment);
        setImportedCount({
          folders: folders.length,
          requests: requests.length,
          environments: environment ? 1 : 0,
        });
        emitDebug(
          "info",
          "import-wizard",
          `Import complete — ${folders.length} folder(s), ${requests.length} request(s)${environment ? ", 1 environment" : ""}`,
        );
        setStep("done");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emitDebug("error", "import-wizard", `FetchBoy import failed: ${msg}`);
        setError(msg);
        setStep("error");
      }
      return;
    }

    // Postman / Insomnia import — parse then preview
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "JSON", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (!selected) {
        emitDebug("info", "import-wizard", "File dialog cancelled");
        return;
      }
      const path = typeof selected === "string" ? selected : selected[0];
      emitDebug("info", "import-wizard", `File selected: ${path}`);
      const text = await readTextFile(path);
      emitDebug(
        "info",
        "import-wizard",
        `File read OK (${text.length} chars) — parsing as ${format}`,
      );
      setResult(parseByFormat(text, format));
      emitDebug("info", "import-wizard", "Parse successful — showing preview");
      setStep("preview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitDebug("error", "import-wizard", `File select/parse failed: ${msg}`);
      setError(msg);
      setStep("error");
    }
  };

  const handleImport = async (): Promise<void> => {
    if (!result) return;
    setStep("importing");
    emitDebug(
      "info",
      "import-wizard",
      `Importing collection "${result.collection.name}" — ${result.folders.length} folder(s), ${result.requests.length} request(s)`,
    );
    try {
      const { collection, folders, requests, environments } =
        await persistImportResult(result);
      emitDebug("info", "import-wizard", `Persisted to DB — updating stores`);
      collectionStore.addCollection(collection);
      for (const f of folders) collectionStore.addFolder(f);
      for (const r of requests) collectionStore.addRequest(r);
      for (const env of environments) envStore.addEnvironment(env);
      setImportedCount({
        folders: folders.length,
        requests: requests.length,
        environments: environments.length,
      });
      emitDebug(
        "info",
        "import-wizard",
        `Import complete — ${folders.length} folder(s), ${requests.length} request(s), ${environments.length} environment(s)`,
      );
      setStep("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitDebug("error", "import-wizard", `Import failed: ${msg}`);
      setError(msg);
      setStep("error");
    }
  };

  const methodCounts = result?.requests.reduce<Record<string, number>>(
    (acc, r) => {
      acc[r.method] = (acc[r.method] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const totalVars =
    result?.environments.reduce((sum, e) => sum + e.variables.length, 0) ?? 0;

  const formatBtn = (
    f: ImportFormat,
    color: "orange" | "purple",
  ): React.ReactElement => {
    const cls =
      color === "orange"
        ? "border-orange-500/30 text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/60"
        : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/60";
    return (
      <button
        key={f}
        onClick={() => selectFormat(f)}
        className={`rounded border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${cls}`}
      >
        {FORMAT_LABEL[f]}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={reset}
    >
      <div
        className="bg-app-main border border-app-subtle w-[28rem] rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-app-primary">
            Import Collection
          </h2>
          <button
            onClick={reset}
            className="text-app-muted hover:text-app-primary cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Step 1: Format select */}
          {step === "format" && (
            <>
              <p className="text-xs text-app-muted">
                Select the format to import:
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-app-primary">
                    FetchBoy
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => selectFormat("fetchboy-v1")}
                      className="rounded border border-white/30 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 hover:border-white/60 cursor-pointer transition-colors"
                    >
                      v1
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-app-primary">
                    Postman
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {formatBtn("postman-v2", "orange")}
                    {formatBtn("postman-v1", "orange")}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-app-primary">
                    Insomnia
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {formatBtn("insomnia-v4", "purple")}
                  </div>
                </div>
              </div>

              {/* Horizontal divider — padded from left/right */}
              <div className="px-4 mt-2">
                <div className="h-px bg-app-subtle" />
              </div>

              {/* AI prompt generation section */}
              <CopyPromptFooter />
            </>
          )}

          {/* Step 2: File select */}
          {step === "file" && format && (
            <>
              <p className="text-xs text-app-muted">
                Select the{" "}
                {format === "fetchboy-v1" ? ".fetchboy" : "exported JSON"} file{" "}
                <span className="text-app-secondary">
                  ({FORMAT_LABEL[format]})
                </span>
                :
              </p>
              <button
                onClick={() => void handleFileSelect()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-app-subtle py-6 text-sm text-app-muted hover:text-app-primary hover:border-blue-500/50 cursor-pointer transition-colors"
              >
                <FileUp size={18} /> Choose File...
              </button>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("format")}
                  className="text-xs text-app-muted hover:text-app-primary cursor-pointer"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && result && (
            <>
              <p className="text-xs text-app-muted">
                Review what will be imported:
              </p>
              <div className="space-y-2 rounded-md border border-app-subtle p-3 text-xs">
                <p className="font-medium text-app-primary">
                  {result.collection.name}
                </p>
                <p className="text-app-muted">
                  {result.folders.length} folder(s), {result.requests.length}{" "}
                  request(s)
                </p>
                {methodCounts && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(methodCounts).map(([m, c]) => (
                      <span
                        key={m}
                        className="rounded bg-app-subtle/30 px-1.5 py-0.5 text-app-secondary"
                      >
                        {m}: {c}
                      </span>
                    ))}
                  </div>
                )}
                {result.environments.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 border-t border-app-subtle pt-2 text-green-400">
                    <Globe size={12} />
                    <span>
                      {result.environments.length} environment(s) with{" "}
                      {totalVars} variable(s) will be created
                    </span>
                  </div>
                )}
                {result.warnings.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-app-subtle pt-2">
                    {result.warnings.map((w, i) => (
                      <p
                        key={i}
                        className="flex items-start gap-1 text-amber-400"
                      >
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />{" "}
                        {w.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep("file")}
                  className="text-xs text-app-muted hover:text-app-primary cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={() => void handleImport()}
                  className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 cursor-pointer"
                >
                  Import
                </button>
              </div>
            </>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <Loader2 size={24} className="animate-spin text-blue-400" />
              <p className="text-xs text-app-muted">Importing collection...</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle2 size={24} className="text-green-400" />
              <p className="text-sm font-medium text-app-primary">
                Import complete!
              </p>
              <p className="text-xs text-app-muted">
                {importedCount.folders} folder(s), {importedCount.requests}{" "}
                request(s) imported
              </p>
              {importedCount.environments > 0 && (
                <p className="text-xs text-green-400">
                  {importedCount.environments} environment(s) created and linked
                </p>
              )}
              <button
                onClick={reset}
                className="mt-2 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertTriangle size={24} className="text-red-400" />
              <p className="text-sm font-medium text-red-400">Import failed</p>
              <p className="text-xs text-app-muted text-center">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setStep("file");
                }}
                className="mt-2 rounded-md border border-app-subtle px-4 py-1.5 text-xs text-app-primary cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
