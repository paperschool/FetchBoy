import { Download } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

/** Map editor languages / content types to sensible file extensions. */
const EXT_MAP: Record<string, { name: string; extensions: string[] }> = {
  json:             { name: 'JSON',       extensions: ['json'] },
  'application/json': { name: 'JSON',     extensions: ['json'] },
  html:             { name: 'HTML',       extensions: ['html', 'htm'] },
  'text/html':      { name: 'HTML',       extensions: ['html', 'htm'] },
  xml:              { name: 'XML',        extensions: ['xml'] },
  'text/xml':       { name: 'XML',        extensions: ['xml'] },
  javascript:       { name: 'JavaScript', extensions: ['js'] },
  plaintext:        { name: 'Text',       extensions: ['txt'] },
  'text/plain':     { name: 'Text',       extensions: ['txt'] },
};

interface SaveContentButtonProps {
  /** The text content to save. */
  content: string;
  /** Editor language or MIME content-type — used to pick the default extension. */
  language: string;
  /** Optional default file name (without extension). */
  defaultName?: string;
}

export function SaveContentButton({ content, language, defaultName = 'response' }: SaveContentButtonProps) {
  const handleSave = async () => {
    const entry = EXT_MAP[language] ?? EXT_MAP.plaintext;
    const ext = entry.extensions[0];
    try {
      const path = await save({
        defaultPath: `${defaultName}.${ext}`,
        filters: [entry, { name: 'All Files', extensions: ['*'] }],
      });
      if (path) await writeTextFile(path, content);
    } catch (err) {
      console.error('[SaveContentButton] Save failed:', err);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      className="flex items-center gap-1 border-app-subtle bg-app-main text-app-primary h-8 rounded-md border px-2 text-xs hover:bg-app-subtle transition-colors"
      title="Save to file"
      aria-label="Save content to file"
    >
      <Download size={13} />
      Save
    </button>
  );
}
