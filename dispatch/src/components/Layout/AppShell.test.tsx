import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders the top bar region', () => {
    render(<AppShell />);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
  });

  it('renders the sidebar region', () => {
    render(<AppShell />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders the main panel region', () => {
    render(<AppShell />);
    expect(screen.getByTestId('main-panel')).toBeInTheDocument();
  });

  it('displays the app name in the top bar', () => {
    render(<AppShell />);
    expect(screen.getByText('Dispatch')).toBeInTheDocument();
  });

  it('displays the Collections heading in the sidebar', () => {
    render(<AppShell />);
    expect(screen.getByText('Collections')).toBeInTheDocument();
  });

  it('displays the Request Builder heading in the main panel', () => {
    render(<AppShell />);
    expect(screen.getByText('Request Builder')).toBeInTheDocument();
  });
});
