import { useEffect, useRef } from 'react';
import Editor, { type Monaco } from '@monaco-editor/react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';
import { FB_API_DTS, FB_API_DTS_PRE, FB_API_DTS_POST } from '@/lib/scriptEngine/fbApiTypes';

type EditorLanguage = 'json' | 'html' | 'xml' | 'plaintext' | 'javascript';

/** Which fb.* surface to advertise — matches the runtime sandbox for that stage. */
export type FbApiStage = 'pre' | 'post' | 'all';
const FB_DTS_BY_STAGE: Record<FbApiStage, string> = {
  pre: FB_API_DTS_PRE,
  post: FB_API_DTS_POST,
  all: FB_API_DTS,
};

// addExtraLib registers globally per JS model under one URI, so re-adding replaces
// the previous lib. Only one fb.* editor is active at a time, so swapping to the
// active stage's surface keeps completions matched to what the runtime provides.
function registerFbApiStage(monaco: Monaco, stage: FbApiStage): void {
  monaco.languages.typescript.javascriptDefaults.addExtraLib(FB_DTS_BY_STAGE[stage], 'ts:fetchboy-api.d.ts');
}

interface MonacoEditorFieldProps {
  value: string;
  language: EditorLanguage;
  readOnly?: boolean;
  fontSize: number;
  path: string;
  testId: string;
  height?: string;
  /** Override the wrapper border (e.g. to highlight a read-only template view). */
  borderClassName?: string;
  /**
   * Register the FetchBoy script API (`fb.*`) IntelliSense for the given stage
   * (Story 20.6/20.9). Only the pre/post members valid for that stage are offered,
   * so completions match what the runtime sandbox actually provides.
   */
  fbApiStage?: FbApiStage;
  onChange?: (value: string) => void;
}

export function MonacoEditorField({ value, language, readOnly = false, fontSize, path, testId, height = '260px', borderClassName = 'border-app-subtle', fbApiStage, onChange }: MonacoEditorFieldProps) {
  const theme = useUiSettingsStore((s) => s.theme);
  const monacoRef = useRef<Monaco | null>(null);

  // Re-register when the stage changes (the Editor stays mounted across slot
  // switches, so beforeMount alone wouldn't fire again).
  useEffect(() => {
    if (monacoRef.current && fbApiStage) registerFbApiStage(monacoRef.current, fbApiStage);
  }, [fbApiStage]);
  const monacoTheme =
    theme === 'dark'
      ? 'vs-dark'
      : theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'vs-dark'
          : 'vs'
        : 'vs';

  return (
    <div data-testid={testId} className={`${borderClassName} min-h-0 overflow-hidden rounded-md border`} style={{ height }}>
      <Editor
        path={path}
        language={language === 'plaintext' ? 'plaintext' : language}
        theme={monacoTheme}
        beforeMount={(monaco) => {
          monacoRef.current = monaco;
          if (fbApiStage) registerFbApiStage(monaco, fbApiStage);
        }}
        value={value}
        onChange={(nextValue) => {
          if (readOnly || !onChange) {
            return;
          }

          onChange(nextValue ?? '');
        }}
        options={{
          readOnly,
          fontSize,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          lineNumbersMinChars: 3,
          tabSize: 2,
        }}
        height="100%"
      />
    </div>
  );
}