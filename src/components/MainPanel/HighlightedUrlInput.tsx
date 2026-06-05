import { useLayoutEffect, useRef } from 'react';
import type { KeyValuePair } from '@/lib/db';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildHighlightHtml(text: string, varKeys: Set<string>): string {
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const varKeys = new Set(variables.map((v) => v.key));

  // Auto-grow the textarea to fit its (wrapped) content so every line is visible
  // and the caret stays aligned with the highlight backdrop — a fixed-height box
  // would scroll internally and the caret would drift from the rendered text.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [value]);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (backdropRef.current) {
      backdropRef.current.scrollTop = e.currentTarget.scrollTop;
      backdropRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Shared text metrics — identical on both layers so glyphs (and the caret)
  // line up exactly between the transparent textarea and the highlight backdrop.
  // Everything is set EXPLICITLY (not `inherit`): a textarea's UA defaults can
  // resolve `inherit` to a different computed font than a div, shifting glyph
  // advance widths and drifting the caret away from the rendered text.
  const textStyle: React.CSSProperties = {
    fontFamily:
      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
    fontSize: '0.875rem', // matches Tailwind text-sm
    lineHeight: '1.25rem', // matches Tailwind leading-5
    letterSpacing: 'normal',
    tabSize: 4,
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    boxSizing: 'border-box',
  };

  return (
    <div className="border-app-subtle relative w-full overflow-hidden rounded-md border">
      {/* Backdrop renders highlighted text behind the transparent textarea */}
      <div
        ref={backdropRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden px-3 py-2 text-sm leading-5"
        style={{ ...textStyle, color: 'var(--app-text-primary)' }}
        dangerouslySetInnerHTML={{ __html: buildHighlightHtml(value, varKeys) }}
      />
      <textarea
        ref={textareaRef}
        id={id}
        aria-label="Request URL"
        value={value}
        rows={1}
        wrap="soft"
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        placeholder={placeholder}
        className="relative block w-full resize-none bg-transparent px-3 py-2 text-sm leading-5"
        style={{
          ...textStyle,
          minHeight: '2.25rem',
          maxHeight: '12rem',
          overflowY: 'auto',
          color: 'transparent',
          caretColor: 'var(--app-text-primary)',
          outline: 'none',
        }}
      />
    </div>
  );
}
