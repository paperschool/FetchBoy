import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('@/lib/collections', () => ({
    loadAllCollections: vi.fn().mockResolvedValue({ collections: [], folders: [], requests: [] }),
}));

describe('AppShell', () => {
  it('renders the top bar region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('renders the sidebar region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('renders the main panel region', async () => {
    render(<AppShell />);
    expect(screen.getByTestId('main-panel')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('displays the app name in the top bar', async () => {
    render(<AppShell />);
    expect(screen.getByText('Fetch Boy 🦴')).toBeInTheDocument();
    await waitFor(() => {});
  });

  it('displays the Collections heading in the sidebar', async () => {
    render(<AppShell />);
    expect(screen.getAllByText('Collections').length).toBeGreaterThan(0);
    await waitFor(() => {});
  });

  it('displays the Request Builder heading in the main panel', async () => {
    render(<AppShell />);
    expect(screen.getByText('Request Builder')).toBeInTheDocument();
    await waitFor(() => {});
  });
});
