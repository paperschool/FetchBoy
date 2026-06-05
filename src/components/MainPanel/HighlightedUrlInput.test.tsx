import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HighlightedUrlInput, buildHighlightHtml } from './HighlightedUrlInput';
import type { KeyValuePair } from '@/lib/db';

const GREEN = 'rgba(34,197,94,0.3)'; // defined variable
const RED = 'rgba(239,68,68,0.3)'; // undefined variable

describe('buildHighlightHtml', () => {
  it('returns empty string for empty input', () => {
    expect(buildHighlightHtml('', new Set())).toBe('');
  });

  it('leaves plain text untouched (no marks)', () => {
    expect(buildHighlightHtml('https://example.com', new Set())).toBe('https://example.com');
  });

  it('highlights a defined variable green', () => {
    const html = buildHighlightHtml('{{base}}/users', new Set(['base']));
    expect(html).toContain(GREEN);
    expect(html).not.toContain(RED);
    expect(html).toContain('{{base}}');
  });

  it('highlights an undefined variable red', () => {
    const html = buildHighlightHtml('{{missing}}/x', new Set(['base']));
    expect(html).toContain(RED);
    expect(html).not.toContain(GREEN);
  });

  it('handles multiple tokens, mixing defined and undefined', () => {
    const html = buildHighlightHtml('{{base}}/{{missing}}', new Set(['base']));
    expect(html).toContain(GREEN);
    expect(html).toContain(RED);
    expect((html.match(/<mark/g) ?? []).length).toBe(2);
  });

  it('trims whitespace inside the token when resolving the key', () => {
    const html = buildHighlightHtml('{{ base }}', new Set(['base']));
    expect(html).toContain(GREEN);
  });

  it('escapes HTML in the surrounding text and the token', () => {
    const html = buildHighlightHtml('<b>&</b>{{x}}', new Set());
    expect(html).toContain('&lt;b&gt;&amp;&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });
});

describe('HighlightedUrlInput', () => {
  const vars: KeyValuePair[] = [{ key: 'base', value: 'https://api.test' }];

  it('mirrors the value in the textarea', () => {
    render(
      <HighlightedUrlInput id="url" value="{{base}}/users" onChange={() => {}} variables={vars} />,
    );
    const textarea = screen.getByLabelText('Request URL') as HTMLTextAreaElement;
    expect(textarea.value).toBe('{{base}}/users');
  });

  it('renders a backdrop whose text content mirrors the value', () => {
    const { container } = render(
      <HighlightedUrlInput id="url" value="{{base}}/users" onChange={() => {}} variables={vars} />,
    );
    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    // <mark> tokens are unwrapped in textContent, so it mirrors the raw value.
    expect(backdrop?.textContent).toBe('{{base}}/users');
  });

  it('keeps the textarea as the focus target (backdrop is non-interactive)', () => {
    const { container } = render(
      <HighlightedUrlInput id="url" value="x" onChange={() => {}} variables={vars} />,
    );
    const textarea = screen.getByLabelText('Request URL') as HTMLTextAreaElement;
    textarea.focus();
    expect(document.activeElement).toBe(textarea);
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(backdrop.className).toContain('pointer-events-none');
  });
});
