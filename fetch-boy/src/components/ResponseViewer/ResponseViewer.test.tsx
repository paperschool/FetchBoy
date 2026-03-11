import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ResponseViewer, type ResponseData, isImageContentType, isPdfContentType, isBinaryContentType } from './ResponseViewer';

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

const imageResponse: ResponseData = {
  status: 200,
  statusText: 'OK',
  responseTimeMs: 100,
  responseSizeBytes: 1024,
  body: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  headers: [],
  contentType: 'image/png',
};

const pdfResponse: ResponseData = {
  status: 200,
  statusText: 'OK',
  responseTimeMs: 150,
  responseSizeBytes: 2048,
  body: 'JVBERi0xLjQK',
  headers: [],
  contentType: 'application/pdf',
};

const binaryResponse: ResponseData = {
  status: 200,
  statusText: 'OK',
  responseTimeMs: 80,
  responseSizeBytes: 512,
  body: 'SGVsbG8gV29ybGQ=',
  headers: [],
  contentType: 'application/octet-stream',
};

const textResponse: ResponseData = {
  status: 200,
  statusText: 'OK',
  responseTimeMs: 50,
  responseSizeBytes: 100,
  body: '{"message":"hello"}',
  headers: [],
  contentType: 'application/json',
};

describe('Story 6.2 cancellation state', () => {
  it('renders "Request cancelled" in neutral styling when wasCancelled=true', () => {
    render(<ResponseViewer response={null} error={null} wasCancelled={true} />);
    const el = screen.getByText(/request cancelled/i);
    expect(el).toBeInTheDocument();
    // Verify NOT using red/error styling
    expect(el.closest('[class*="red"]')).toBeNull();
  });

  it('does not render cancellation message when wasCancelled=false with a response', () => {
    render(<ResponseViewer response={sampleResponse} error={null} wasCancelled={false} />);
    expect(screen.queryByText(/request cancelled/i)).not.toBeInTheDocument();
  });

  it('renders empty state when wasCancelled=false, no response, no error, no logs', () => {
    render(<ResponseViewer response={null} error={null} wasCancelled={false} />);
    expect(screen.getByText('Hit Send to see your response')).toBeInTheDocument();
  });

  it('normal error display is unaffected when wasCancelled=false', () => {
    render(<ResponseViewer response={null} error="Connection refused" wasCancelled={false} />);
    expect(screen.getByText('Request Error')).toBeInTheDocument();
    expect(screen.getByText('Connection refused')).toBeInTheDocument();
  });
});

describe('Story 6.4 timeout state', () => {
  it('renders "Timed out after Xs" in neutral styling when wasTimedOut=true', () => {
    render(<ResponseViewer response={null} error={null} wasTimedOut={true} timedOutAfterSec={30} />);
    const el = screen.getByText(/timed out after 30s/i);
    expect(el).toBeInTheDocument();
    expect(el.closest('[class*="red"]')).toBeNull();
  });

  it('renders fallback timeout message when timedOutAfterSec is null', () => {
    render(<ResponseViewer response={null} error={null} wasTimedOut={true} timedOutAfterSec={null} />);
    expect(screen.getByText(/request timed out/i)).toBeInTheDocument();
  });

  it('does not render timeout message when wasTimedOut=false', () => {
    render(<ResponseViewer response={null} error={null} wasTimedOut={false} />);
    expect(screen.queryByText(/timed out/i)).not.toBeInTheDocument();
  });

  it('renders empty state when wasTimedOut=false, no response, no error, no logs, no cancellation', () => {
    render(<ResponseViewer response={null} error={null} wasTimedOut={false} />);
    expect(screen.getByText('Hit Send to see your response')).toBeInTheDocument();
  });
});

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

describe('Story 7.7 Image & Binary Response Handling', () => {
  describe('Helper functions', () => {
    it('isImageContentType returns true for image/* types', () => {
      expect(isImageContentType('image/png')).toBe(true);
      expect(isImageContentType('image/jpeg')).toBe(true);
      expect(isImageContentType('image/gif')).toBe(true);
      expect(isImageContentType('image/webp')).toBe(true);
      expect(isImageContentType('image/svg+xml')).toBe(true);
    });

    it('isImageContentType returns false for non-image types', () => {
      expect(isImageContentType('application/json')).toBe(false);
      expect(isImageContentType('text/plain')).toBe(false);
      expect(isImageContentType('application/pdf')).toBe(false);
    });

    it('isPdfContentType returns true for application/pdf', () => {
      expect(isPdfContentType('application/pdf')).toBe(true);
    });

    it('isPdfContentType returns false for non-pdf types', () => {
      expect(isPdfContentType('image/png')).toBe(false);
      expect(isPdfContentType('application/json')).toBe(false);
    });

    it('isBinaryContentType returns true for images, pdf, and octet-stream', () => {
      expect(isBinaryContentType('image/png')).toBe(true);
      expect(isBinaryContentType('image/jpeg')).toBe(true);
      expect(isBinaryContentType('application/pdf')).toBe(true);
      expect(isBinaryContentType('application/octet-stream')).toBe(true);
    });

    it('isBinaryContentType returns false for text types', () => {
      expect(isBinaryContentType('application/json')).toBe(false);
      expect(isBinaryContentType('text/plain')).toBe(false);
      expect(isBinaryContentType('text/html')).toBe(false);
      expect(isBinaryContentType('application/xml')).toBe(false);
    });
  });

  describe('Binary response rendering', () => {
    it('renders image preview for image/png content type', () => {
      render(<ResponseViewer response={imageResponse} error={null} />);
      
      const img = screen.getByAltText('Response image');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png;base64,'));
    });

    it('renders download link for application/pdf', () => {
      render(<ResponseViewer response={pdfResponse} error={null} />);
      
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
      const link = screen.getByText('Download PDF').closest('a');
      expect(link).toHaveAttribute('download', 'response.pdf');
    });

    it('renders download button for application/octet-stream', () => {
      render(<ResponseViewer response={binaryResponse} error={null} />);
      
      expect(screen.getByText('Download File')).toBeInTheDocument();
      expect(screen.getByText('Binary file detected (application/octet-stream)')).toBeInTheDocument();
    });

    it('renders Monaco editor for text content', () => {
      render(<ResponseViewer response={textResponse} error={null} />);
      
      expect(screen.getByTestId('response-body-editor')).toBeInTheDocument();
    });

    it('does not show image when contentType is undefined', () => {
      const responseNoContentType: ResponseData = {
        status: 200,
        statusText: 'OK',
        responseTimeMs: 50,
        responseSizeBytes: 100,
        body: '{"message":"hello"}',
        headers: [],
      };
      
      render(<ResponseViewer response={responseNoContentType} error={null} />);
      
      expect(screen.queryByAltText('Response image')).not.toBeInTheDocument();
      expect(screen.getByTestId('response-body-editor')).toBeInTheDocument();
    });

    it('shows Raw option in language dropdown', () => {
      render(<ResponseViewer response={textResponse} error={null} />);
      
      const select = screen.getByRole('combobox', { name: 'Response Body Language' });
      expect(select).toHaveValue('json');
      
      fireEvent.change(select, { target: { value: 'plaintext' } });
      expect(select).toHaveValue('plaintext');
    });
  });
});

