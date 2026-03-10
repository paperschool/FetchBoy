import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResponseViewer, type ResponseData } from './ResponseViewer';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, options, language, path }: { value?: string; options?: { readOnly?: boolean; fontSize?: number }; language?: string; path?: string }) => (
    <div
      data-testid="monaco-editor"
      data-readonly={options?.readOnly ? 'true' : 'false'}
      data-font-size={String(options?.fontSize ?? '')}
      data-language={language ?? ''}
      data-path={path ?? ''}
    >
      {value}
    </div>
  ),
}));

const sampleResponse: ResponseData = {
  status: 200,
  statusText: 'OK',
  responseTimeMs: 42,
  responseSizeBytes: 120,
  body: '{"ok":true,"name":"dispatch"}',
  headers: [{ key: 'content-type', value: 'application/json' }],
};

describe('ResponseViewer Monaco integration', () => {
  it('renders body with read-only Monaco editor', () => {
    render(<ResponseViewer response={sampleResponse} error={null} />);

    const editor = screen.getByTestId('response-body-editor');
    expect(editor).toBeInTheDocument();
    expect(within(editor).getByTestId('monaco-editor')).toHaveAttribute('data-readonly', 'true');
  });

  it('pretty-prints valid JSON response body in Monaco', () => {
    render(<ResponseViewer response={sampleResponse} error={null} />);

    const editor = within(screen.getByTestId('response-body-editor')).getByTestId('monaco-editor');
    expect(editor.textContent).toContain('\n  "ok": true');
    expect(editor.textContent).toContain('\n  "name": "dispatch"');
  });

  it('supports switching response language modes', () => {
    render(<ResponseViewer response={sampleResponse} error={null} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Response Body Language' }), {
      target: { value: 'xml' },
    });

    const editor = within(screen.getByTestId('response-body-editor')).getByTestId('monaco-editor');
    expect(editor).toHaveAttribute('data-language', 'xml');
  });
});
