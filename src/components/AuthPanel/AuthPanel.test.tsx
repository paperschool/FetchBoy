import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AuthPanel } from './AuthPanel';
import type { AuthState } from '@/stores/requestStore';

describe('AuthPanel', () => {
  it('renders "No Auth" dropdown by default with type none', () => {
    const auth: AuthState = { type: 'none' };
    render(<AuthPanel auth={auth} onAuthChange={vi.fn()} />);
    expect(screen.getByRole('combobox', { name: /auth type/i })).toHaveValue('none');
    expect(screen.getByText('No auth will be applied to this request.')).toBeInTheDocument();
  });

  it('switching to Bearer Token shows token input and fires onAuthChange with fresh default', () => {
    const auth: AuthState = { type: 'none' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /auth type/i }), {
      target: { value: 'bearer' },
    });

    expect(onAuthChange).toHaveBeenCalledWith({ type: 'bearer', token: '' });
  });

  it('Bearer token input change fires onAuthChange with updated token', () => {
    const auth: AuthState = { type: 'bearer', token: '' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByLabelText(/token/i), { target: { value: 'my-secret-token' } });

    expect(onAuthChange).toHaveBeenCalledWith({ type: 'bearer', token: 'my-secret-token' });
  });

  it('switching to Basic Auth shows username and password inputs', () => {
    const auth: AuthState = { type: 'none' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /auth type/i }), {
      target: { value: 'basic' },
    });

    expect(onAuthChange).toHaveBeenCalledWith({ type: 'basic', username: '', password: '' });
  });

  it('Basic username and password changes call onAuthChange correctly', () => {
    const auth: AuthState = { type: 'basic', username: '', password: '' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'admin' } });
    expect(onAuthChange).toHaveBeenCalledWith({ type: 'basic', username: 'admin', password: '' });

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    expect(onAuthChange).toHaveBeenCalledWith({ type: 'basic', username: '', password: 'secret' });
  });

  it('switching to API Key shows key-name, key-value, and location select', () => {
    const auth: AuthState = { type: 'none' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /auth type/i }), {
      target: { value: 'api-key' },
    });

    expect(onAuthChange).toHaveBeenCalledWith({ type: 'api-key', key: '', value: '', in: 'header' });
  });

  it('API Key location toggle (header → query) calls onAuthChange with in: query', () => {
    const auth: AuthState = { type: 'api-key', key: 'X-API-Key', value: 'abc', in: 'header' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'query' } });

    expect(onAuthChange).toHaveBeenCalledWith({
      type: 'api-key',
      key: 'X-API-Key',
      value: 'abc',
      in: 'query',
    });
  });

  it('switching back to None resets to minimal { type: none } display', () => {
    const auth: AuthState = { type: 'bearer', token: 'some-token' };
    const onAuthChange = vi.fn();
    render(<AuthPanel auth={auth} onAuthChange={onAuthChange} />);

    fireEvent.change(screen.getByRole('combobox', { name: /auth type/i }), {
      target: { value: 'none' },
    });

    expect(onAuthChange).toHaveBeenCalledWith({ type: 'none' });
  });
});
