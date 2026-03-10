import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MainPanel } from './MainPanel';
import { useRequestStore } from '@/stores/requestStore';

describe('MainPanel request builder', () => {
  beforeEach(() => {
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
});
