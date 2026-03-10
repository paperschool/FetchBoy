import Editor from '@monaco-editor/react';

interface MonacoEditorFieldProps {
  value: string;
  language: 'json' | 'html' | 'xml';
  readOnly?: boolean;
  fontSize: number;
  path: string;
  testId: string;
  onChange?: (value: string) => void;
}

export function MonacoEditorField({ value, language, readOnly = false, fontSize, path, testId, onChange }: MonacoEditorFieldProps) {
  return (
    <div data-testid={testId} className="border-app-subtle overflow-hidden rounded-md border">
      <Editor
        path={path}
        language={language}
        theme="vs"
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
        height="260px"
      />
    </div>
  );
}