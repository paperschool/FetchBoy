import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CopyAsButton } from './CopyAsButton';
import type { ResolvedRequest } from '@/lib/generateSnippet';

const resolvedRequest: ResolvedRequest = {
  method: 'GET',
  url: 'https://api.example.com/test',
  headers: [],
  queryParams: [],
  body: { mode: 'none', raw: '' },
  auth: { type: 'none' },
};

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('CopyAsButton', () => {
  it('renders a button element', () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    expect(screen.getByTestId('copy-as-button')).toBeInTheDocument();
  });

  it('clicking the button opens the dropdown', () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    expect(screen.queryByTestId('copy-as-dropdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('copy-as-button'));
    expect(screen.getByTestId('copy-as-dropdown')).toBeInTheDocument();
  });

  it('dropdown contains all four format labels', () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    fireEvent.click(screen.getByTestId('copy-as-button'));

    expect(screen.getByRole('menuitem', { name: 'cURL' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Python (requests)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'JavaScript (fetch)' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Node.js (axios)' })).toBeInTheDocument();
  });

  it('clicking cURL calls navigator.clipboard.writeText with a non-empty string', async () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    fireEvent.click(screen.getByTestId('copy-as-button'));

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'cURL' }));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('curl'));
  });

  it('after clicking a format option, the Copied! span appears', async () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    fireEvent.click(screen.getByTestId('copy-as-button'));

    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'cURL' }));
    });

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('clicking outside closes the dropdown', () => {
    render(
      <div>
        <CopyAsButton resolvedRequest={resolvedRequest} />
        <div data-testid="outside">outside</div>
      </div>,
    );

    fireEvent.click(screen.getByTestId('copy-as-button'));
    expect(screen.getByTestId('copy-as-dropdown')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('copy-as-dropdown')).not.toBeInTheDocument();
  });

  it('pressing the button again closes the dropdown (toggle)', () => {
    render(<CopyAsButton resolvedRequest={resolvedRequest} />);
    const btn = screen.getByTestId('copy-as-button');

    fireEvent.click(btn);
    expect(screen.getByTestId('copy-as-dropdown')).toBeInTheDocument();

    fireEvent.click(btn);
    expect(screen.queryByTestId('copy-as-dropdown')).not.toBeInTheDocument();
  });
});
