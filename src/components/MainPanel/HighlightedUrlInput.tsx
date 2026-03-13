import { useRef } from 'react';
import type { KeyValuePair } from '@/lib/db';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHighlightHtml(text: string, varKeys: Set<string>): string {
  if (!text) return '';
  const parts: string[] = [];
  let lastIndex = 0;
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    parts.push(escapeHtml(text.slice(lastIndex, match.index)));
    const key = match[1].trim();
    const style = varKeys.has(key)
      ? 'background:rgba(34,197,94,0.3);border-radius:2px;color:inherit'
      : 'background:rgba(239,68,68,0.3);border-radius:2px;color:inherit';
    parts.push(`<mark style="${style}">${escapeHtml(match[0])}</mark>`);
    lastIndex = match.index + match[0].length;
  }
  parts.push(escapeHtml(text.slice(lastIndex)));
  return parts.join('');
}

interface HighlightedUrlInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variables: KeyValuePair[];
}

export function HighlightedUrlInput({
  id,
  value,
  onChange,
  placeholder,
  variables,
}: HighlightedUrlInputProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const varKeys = new Set(variables.map((v) => v.key));

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="border-app-subtle relative w-full overflow-hidden rounded-md border">
      {/* Backdrop renders highlighted text behind the transparent textarea */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 px-3 py-2 text-sm leading-5"
        style={{
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          color: 'var(--app-text-primary)',
          fontFamily: 'inherit',
        }}
        dangerouslySetInnerHTML={{ __html: buildHighlightHtml(value, varKeys) }}
      />
      <textarea
        id={id}
        aria-label="Request URL"
        value={value}
        rows={1}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        className="relative w-full resize-y bg-transparent px-3 py-2 text-sm leading-5"
        style={{
          minHeight: '2.25rem',
          color: 'transparent',
          caretColor: 'var(--app-text-primary)',
          fontFamily: 'inherit',
          wordBreak: 'break-all',
          whiteSpace: 'pre-wrap',
          outline: 'none',
        }}
      />
    </div>
  );
}
