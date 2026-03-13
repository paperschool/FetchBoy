import { useState, useEffect, useRef } from 'react';
import { Code2 } from 'lucide-react';
import { generateSnippet, type SnippetFormat, type ResolvedRequest } from '@/lib/generateSnippet';

export interface CopyAsButtonProps {
  resolvedRequest: ResolvedRequest;
}

const FORMATS: Array<{ id: SnippetFormat; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'python', label: 'Python (requests)' },
  { id: 'javascript', label: 'JavaScript (fetch)' },
  { id: 'nodejs', label: 'Node.js (axios)' },
];

export function CopyAsButton({ resolvedRequest }: CopyAsButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  const handleCopy = async (format: SnippetFormat) => {
    const snippet = generateSnippet(format, resolvedRequest);
    await navigator.clipboard.writeText(snippet);
    setOpen(false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative flex items-center" ref={containerRef}>
      <button
        type="button"
        data-testid="copy-as-button"
        onClick={() => setOpen((prev) => !prev)}
        className="border-app-subtle text-app-secondary h-9 rounded-md border px-3 flex items-center cursor-pointer"
        title="Copy as…"
      >
        <Code2 size={15} />
      </button>
      {copied && (
        <span className="text-xs text-green-500 ml-2">Copied!</span>
      )}
      {open && (
        <ul
          role="menu"
          data-testid="copy-as-dropdown"
          className="absolute z-50 min-w-[10rem] rounded-md border border-app-subtle bg-app-main py-1 shadow-lg text-sm right-0 top-full mt-1"
        >
          {FORMATS.map((fmt) => (
            <li key={fmt.id}>
              <button
                type="button"
                role="menuitem"
                className="w-full px-3 py-1.5 text-left text-app-primary hover:bg-app-subtle cursor-pointer"
                onClick={() => void handleCopy(fmt.id)}
              >
                {fmt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
