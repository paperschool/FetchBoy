import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MainPanel } from './MainPanel';
import { useTabStore, createDefaultRequestSnapshot, createDefaultResponseSnapshot } from '@/stores/tabStore';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, options, path }: { value?: string; onChange?: (value?: string) => void; options?: { readOnly?: boolean; fontSize?: number }; path?: string }) => (
    <div data-testid="monaco-editor" data-readonly={options?.readOnly ? 'true' : 'false'} data-font-size={String(options?.fontSize ?? '')} data-path={path ?? ''}>
      <textarea
        aria-label={options?.readOnly ? 'Monaco Readonly' : 'Monaco Input'}
        value={value ?? ''}
        onChange={(event) => onChange?.(event.target.value)}
        readOnly={Boolean(options?.readOnly)}
      />
    </div>
  ),
}));

const invokeMock = vi.fn();
const executeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/lib/history', () => ({
  persistHistoryEntry: (...args: unknown[]) => executeMock(...args),
}));

vi.mock('@/lib/collections', () => ({
  createFullSavedRequest: vi.fn().mockResolvedValue({}),
  updateSavedRequest: vi.fn().mockResolvedValue(undefined),
}));

const { interpolateFn, unresolvedInFn } = vi.hoisted(() => ({
  interpolateFn: vi.fn((str: string) => str),
  unresolvedInFn: vi.fn((): string[] => []),
}));

vi.mock('@/hooks/useEnvironment', () => ({
  useEnvironment: () => ({
    interpolate: interpolateFn,
    unresolvedIn: unresolvedInFn,
    activeVariables: [],
  }),
}));

describe('MainPanel request builder', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    executeMock.mockReset();
    interpolateFn.mockReset();
    unresolvedInFn.mockReset();

    invokeMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      responseTimeMs: 42,
      responseSizeBytes: 120,
      body: '{"ok":true}',
      headers: [{ key: 'content-type', value: 'application/json' }],
    });
    executeMock.mockResolvedValue(undefined);
    // Default: interpolate is a passthrough, no unresolved vars
    interpolateFn.mockImplementation((str: string) => str);
    unresolvedInFn.mockReturnValue([]);

    // Reset tabStore to a clean tab with default per-tab state
    const freshTab = {
      id: crypto.randomUUID(),
      label: 'New Request',
      isCustomLabel: false,
      requestState: createDefaultRequestSnapshot(),
      responseState: createDefaultResponseSnapshot(),
    };
    useTabStore.setState({ tabs: [freshTab], activeTabId: freshTab.id });
  });

  it('renders method selector and url input', () => {
    render(<MainPanel />);

    expect(screen.getByLabelText('HTTP Method')).toBeInTheDocument();
    expect(screen.getByLabelText('Request URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByTestId('request-details-accordion')).toBeInTheDocument();
  });

  it('updates method and url in request store', () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('HTTP Method'), {
      target: { value: 'POST' },
    });
    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com/users' },
    });

    const { activeTabId, tabs } = useTabStore.getState();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    expect(activeTab?.requestState.method).toBe('POST');
    expect(activeTab?.requestState.url).toBe('https://api.example.com/users');
  });

  it('switches tabs and shows body/auth content', () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(screen.getByTestId('request-body-editor')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Request Body Language' })).toBeInTheDocument();
    expect(screen.getByLabelText('Monaco Input')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Auth' }));
    expect(screen.getByText('No auth will be applied to this request.')).toBeInTheDocument();
  });

  it('updates body raw value through Monaco input', () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    fireEvent.change(screen.getByLabelText('Monaco Input'), {
      target: { value: '{"name":"dispatch"}' },
    });

    const { activeTabId, tabs } = useTabStore.getState();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    expect(activeTab?.requestState.body.raw).toBe('{"name":"dispatch"}');
  });

  it('adds and edits a header row', () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Header' }));

    fireEvent.change(screen.getByLabelText('headers-key-0'), {
      target: { value: 'Accept' },
    });
    fireEvent.change(screen.getByLabelText('headers-value-0'), {
      target: { value: 'application/json' },
    });

    const { activeTabId, tabs } = useTabStore.getState();
    const activeTab = tabs.find((t) => t.id === activeTabId);
    expect(activeTab?.requestState.headers[0]).toEqual({
      key: 'Accept',
      value: 'application/json',
      enabled: true,
    });
  });

  it('shows validation message when sending without url', () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(screen.getByText('Request Error')).toBeInTheDocument();
    expect(screen.getByText('Please enter a URL first.')).toBeInTheDocument();
  });

  it('invokes send_request with normalized url and renders response summary', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'httpbin.org/get' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    expect(invokeMock).toHaveBeenCalledWith('send_request', {
      request: expect.objectContaining({
        method: 'GET',
        url: 'https://httpbin.org/get',
      }),
    });

    expect(screen.getByText('200 OK')).toBeInTheDocument();
    expect(screen.getByText('Time: 42 ms')).toBeInTheDocument();
    expect(screen.getByText('Size: 120 bytes')).toBeInTheDocument();
    expect((screen.getByLabelText('Monaco Readonly') as HTMLTextAreaElement).value).toContain('"ok": true');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('shows requested URL with enabled query params after send', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.org/get' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Query Params' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Query Param' }));

    fireEvent.change(screen.getByLabelText('query-key-0'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByLabelText('query-value-0'), {
      target: { value: '123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');
    expect(screen.getByText('https://httpbin.org/get?test=123')).toBeInTheDocument();
  });

  it('renders response body in read-only Monaco with pretty JSON by default', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://jsonplaceholder.typicode.com/todos/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');
    expect(screen.getByLabelText('Monaco Readonly')).toBeInTheDocument();
    expect((screen.getByLabelText('Monaco Readonly') as HTMLTextAreaElement).value).toContain('"ok": true');
  });

  it('shows response headers in read-only headers tab', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://httpbin.org/get' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('200 OK');

    const responseViewer = screen.getByTestId('response-viewer');
    fireEvent.click(within(responseViewer).getByRole('button', { name: 'Headers' }));

    expect(screen.getByText('content-type')).toBeInTheDocument();
    expect(screen.getByText('application/json')).toBeInTheDocument();
  });

  it('logs send lifecycle messages in verbose logs accordion', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://jsonplaceholder.typicode.com/todos/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    const responseViewer = screen.getByTestId('response-viewer');
    fireEvent.click(within(responseViewer).getByRole('button', { name: /^Logs/ }));

    expect(responseViewer).toHaveTextContent('Send clicked with method=GET');
    expect(responseViewer).toHaveTextContent('Invoking Rust command: send_request');
    expect(responseViewer).toHaveTextContent('Send flow completed.');
  });

  it('clears verbose logs when clicking Clear Logs', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://jsonplaceholder.typicode.com/todos/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    const responseViewer = screen.getByTestId('response-viewer');
    fireEvent.click(within(responseViewer).getByRole('button', { name: /^Logs/ }));
    expect(responseViewer).toHaveTextContent('Send clicked with method=GET');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Logs' }));

    expect(responseViewer).toHaveTextContent('No logs yet. Click Send to capture runtime details.');
  });

  it('shows readable error when invoke fails and still persists history', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network down'));

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com/fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Request Error');
    expect(screen.getByText(/Request failed: Network down/)).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces object-shaped invoke errors instead of Unknown error', async () => {
    invokeMock.mockRejectedValueOnce({ message: 'Network request failed: dns error' });

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com/fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Request Error');
    expect(screen.getByText(/Request failed: Network request failed: dns error/)).toBeInTheDocument();
  });

  it('passes interpolated URL to invoke when URL contains a resolved variable', async () => {
    interpolateFn.mockImplementation((str: string) => {
      if (str === 'https://{{BASE_URL}}/posts/1') return 'https://api.example.com/posts/1';
      return str;
    });

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: '{{BASE_URL}}/posts/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    expect(invokeMock).toHaveBeenCalledWith('send_request', {
      request: expect.objectContaining({
        url: 'https://api.example.com/posts/1',
      }),
    });
  });

  it('shows unresolved variable warning when unresolvedIn returns tokens', () => {
    unresolvedInFn.mockReturnValue(['BASE_URL']);

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: '{{BASE_URL}}/posts/1' },
    });

    expect(screen.getByText(/⚠ Unresolved:.*\{\{BASE_URL\}\}/)).toBeInTheDocument();
  });

  it('does not show warning when unresolvedIn returns empty array', () => {
    unresolvedInFn.mockReturnValue([]);

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com' },
    });

    expect(screen.queryByText(/⚠ Unresolved:/)).not.toBeInTheDocument();
  });
});
