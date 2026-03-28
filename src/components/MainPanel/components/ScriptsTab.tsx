import { MonacoEditorField } from "@/components/Editor/MonacoEditorField";

interface ScriptsTabProps {
  script: string;
  enabled: boolean;
  onScriptChange: (script: string) => void;
  onEnabledChange: (enabled: boolean) => void;
  editorFontSize: number;
}

export function ScriptsTab({
  script,
  enabled,
  onScriptChange,
  onEnabledChange,
  editorFontSize,
}: ScriptsTabProps): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="text-app-secondary block text-sm font-medium">
          Pre-request Script
        </label>
        <label className="text-app-secondary inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            aria-label="Enable pre-request script"
          />
          Enabled
        </label>
      </div>

      <p className="text-app-muted text-xs">
        Runs before each request. Use the <code className="text-app-accent">fb</code> object to read/write env vars, headers, query params, body, and URL.
      </p>

      <MonacoEditorField
        testId="pre-request-script-editor"
        path="pre-request-script"
        language="javascript"
        value={script}
        fontSize={editorFontSize}
        onChange={onScriptChange}
      />
    </div>
  );
}
