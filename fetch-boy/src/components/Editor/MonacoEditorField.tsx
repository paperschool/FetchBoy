import Editor from '@monaco-editor/react';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

type EditorLanguage = 'json' | 'html' | 'xml' | 'plaintext';

interface MonacoEditorFieldProps {
  value: string;
  language: EditorLanguage;
  readOnly?: boolean;
  fontSize: number;
  path: string;
  testId: string;
  height?: string;
  onChange?: (value: string) => void;
}

export function MonacoEditorField({ value, language, readOnly = false, fontSize, path, testId, height = '260px', onChange }: MonacoEditorFieldProps) {
  const theme = useUiSettingsStore((s) => s.theme);
  const monacoTheme =
    theme === 'dark'
      ? 'vs-dark'
      : theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'vs-dark'
          : 'vs'
        : 'vs';

  return (
    <div data-testid={testId} className="border-app-subtle min-h-0 overflow-hidden rounded-md border" style={{ height }}>
      <Editor
        path={path}
        language={language === 'plaintext' ? 'plaintext' : language}
        theme={monacoTheme}
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