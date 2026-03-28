import { MonacoEditorField } from "@/components/Editor/MonacoEditorField";

const PLACEHOLDER = `// ── Pre-request Script API ──────────────────────────
//
// fb.env.get(key)              → read an environment variable
// fb.env.set(key, value)       → write an environment variable (persisted)
//
// fb.request.url               → read / write the request URL
// fb.request.method            → read the HTTP method (read-only)
// fb.request.headers           → read / write headers  [{ key, value, enabled }]
// fb.request.queryParams       → read / write params   [{ key, value, enabled }]
// fb.request.body              → read / write the body string
//
// fb.utils.uuid()              → UUID v4
// fb.utils.timestamp()         → Unix seconds
// fb.utils.timestampMs()       → Unix milliseconds
// fb.utils.base64Encode(str)   → Base-64 encode
// fb.utils.base64Decode(str)   → Base-64 decode
// fb.utils.sha256(str)         → SHA-256 hex digest
// fb.utils.hmacSha256(key,str) → HMAC-SHA-256 hex digest
//
// Example: add a timestamp header before every request
// fb.request.headers.push({ key: "X-Timestamp", value: String(fb.utils.timestamp()), enabled: true });
`;

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

      <MonacoEditorField
        testId="pre-request-script-editor"
        path="pre-request-script"
        language="javascript"
        value={script || PLACEHOLDER}
        fontSize={editorFontSize}
        onChange={(value) => {
          onScriptChange(value === PLACEHOLDER ? "" : value);
        }}
      />
    </div>
  );
}
