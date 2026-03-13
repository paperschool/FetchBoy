import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WhatsNewModal, ChangelogEntry } from './WhatsNewModal';

const mockChangelog: ChangelogEntry[] = [
    {
        version: '0.1.0',
        date: '2026-03-11',
        changes: ['Initial release', 'Request builder with Monaco editor', 'Collections support'],
    },
];

const multiChangelog: ChangelogEntry[] = [
    {
        version: '0.3.0',
        date: '2026-03-13',
        changes: ['Intercept detail view', 'Open in Fetch button'],
    },
    {
        version: '0.2.0',
        date: '2026-03-12',
        changes: ['Tab shell', 'MITM proxy'],
    },
    {
        version: '0.1.0',
        date: '2026-03-11',
        changes: ['Initial release'],
    },
];

describe('WhatsNewModal', () => {
    it('renders modal with title', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByTestId('whats-new-modal')).toBeInTheDocument();
        expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    it('displays version badge', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getAllByText('v0.1.0').length).toBeGreaterThanOrEqual(1);
    });

    it('displays changelog date', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByText('2026-03-11')).toBeInTheDocument();
    });

    it('displays all changes as bullet points', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByText('Initial release')).toBeInTheDocument();
        expect(screen.getByText('Request builder with Monaco editor')).toBeInTheDocument();
        expect(screen.getByText('Collections support')).toBeInTheDocument();
    });

    it('renders changelog list', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByTestId('changelog-list')).toBeInTheDocument();
    });

    it('calls onDismiss when Got it button clicked', () => {
        const onDismiss = vi.fn();
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={onDismiss} />);
        fireEvent.click(screen.getByTestId('whats-new-dismiss'));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders Got it dismiss button', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByTestId('whats-new-dismiss')).toBeInTheDocument();
        expect(screen.getByText('Got it')).toBeInTheDocument();
    });

    it('closes on Escape key', () => {
        const onDismiss = vi.fn();
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={onDismiss} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not close on non-Escape key', () => {
        const onDismiss = vi.fn();
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={onDismiss} />);
        fireEvent.keyDown(window, { key: 'Enter' });
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it('renders overlay backdrop', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByTestId('whats-new-overlay')).toBeInTheDocument();
    });

    it('opens the latest version accordion by default', () => {
        render(<WhatsNewModal version="0.3.0" changelog={multiChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByText('Intercept detail view')).toBeInTheDocument();
        expect(screen.queryByText('Tab shell')).not.toBeInTheDocument();
    });

    it('renders an accordion row for every version', () => {
        render(<WhatsNewModal version="0.3.0" changelog={multiChangelog} onDismiss={vi.fn()} />);
        const buttons = screen.getAllByRole('button');
        const versionButtons = buttons.filter((b) => b.textContent?.includes('v0.'));
        expect(versionButtons.length).toBeGreaterThanOrEqual(3);
    });

    it('expands another version when its header is clicked', () => {
        render(<WhatsNewModal version="0.3.0" changelog={multiChangelog} onDismiss={vi.fn()} />);
        const v02Button = screen.getAllByRole('button').find((b) => b.textContent?.includes('v0.2.0'))!;
        fireEvent.click(v02Button);
        expect(screen.getByText('Tab shell')).toBeInTheDocument();
    });

    it('collapses open version when its header is clicked again', () => {
        render(<WhatsNewModal version="0.3.0" changelog={multiChangelog} onDismiss={vi.fn()} />);
        const v03Button = screen.getAllByRole('button').find((b) => b.textContent?.includes('v0.3.0'))!;
        fireEvent.click(v03Button);
        expect(screen.queryByText('Intercept detail view')).not.toBeInTheDocument();
    });
});
