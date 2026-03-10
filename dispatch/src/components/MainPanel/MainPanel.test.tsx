import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MainPanel } from './MainPanel';
import { useRequestStore } from '@/stores/requestStore';

const invokeMock = vi.fn();
const executeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/lib/history', () => ({
  persistHistoryEntry: (...args: unknown[]) => executeMock(...args),
}));

describe('MainPanel request builder', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    executeMock.mockReset();

    invokeMock.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      responseTimeMs: 42,
      responseSizeBytes: 120,
      body: '{"ok":true}',
      headers: [{ key: 'content-type', value: 'application/json' }],
    });
    executeMock.mockResolvedValue(undefined);

    useRequestStore.setState({
      method: 'GET',
      url: '',
      headers: [],
      queryParams: [],
      body: { mode: 'raw', raw: '' },
      auth: { type: 'none' },
      activeTab: 'headers',
    });
  });

  it('renders method selector and url input', () => {
    render(<MainPanel />);

    expect(screen.getByLabelText('HTTP Method')).toBeInTheDocument();
    expect(screen.getByLabelText('Request URL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
    expect(screen.getByTestId('verbose-logs-accordion')).toBeInTheDocument();
  });

  it('updates method and url in request store', () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('HTTP Method'), {
      target: { value: 'POST' },
    });
    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com/users' },
    });

    expect(useRequestStore.getState().method).toBe('POST');
    expect(useRequestStore.getState().url).toBe('https://api.example.com/users');
  });

  it('switches tabs and shows body/auth content', () => {
    render(<MainPanel />);

    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(screen.getByLabelText('Raw Body')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Auth' }));
    expect(screen.getByText('Auth: None')).toBeInTheDocument();
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

    expect(useRequestStore.getState().headers[0]).toEqual({
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
    expect(screen.getByText('{"ok":true}')).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('supports split body views between raw and interactive json', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://jsonplaceholder.typicode.com/todos/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    const responseViewer = screen.getByTestId('response-viewer');
    fireEvent.click(within(responseViewer).getByRole('button', { name: 'JSON' }));

    expect(within(responseViewer).getByTestId('response-json-view')).toBeInTheDocument();
    expect(within(responseViewer).getByText('ok:')).toBeInTheDocument();
    expect(within(responseViewer).getByText('true')).toBeInTheDocument();
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

    const accordion = screen.getByTestId('verbose-logs-accordion');
    fireEvent.click(screen.getByText(/Verbose Logs/));

    expect(accordion).toHaveTextContent('Send clicked with method=GET');
    expect(accordion).toHaveTextContent('Invoking Rust command: send_request');
    expect(accordion).toHaveTextContent('Send flow completed.');
  });

  it('clears verbose logs when clicking Clear Logs', async () => {
    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://jsonplaceholder.typicode.com/todos/1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('200 OK');

    const accordion = screen.getByTestId('verbose-logs-accordion');
    fireEvent.click(screen.getByText(/Verbose Logs/));
    expect(accordion).toHaveTextContent('Send clicked with method=GET');

    fireEvent.click(screen.getByRole('button', { name: 'Clear Logs' }));

    expect(accordion).toHaveTextContent('No logs yet. Click Send to capture runtime details.');
  });

  it('shows readable error when invoke fails and still persists history', async () => {
    invokeMock.mockRejectedValueOnce(new Error('Network down'));

    render(<MainPanel />);

    fireEvent.change(screen.getByLabelText('Request URL'), {
      target: { value: 'https://api.example.com/fail' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await screen.findByText('Request Error');
    expect(screen.getByText('Request failed: Network down')).toBeInTheDocument();
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
