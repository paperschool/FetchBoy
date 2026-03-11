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

describe('WhatsNewModal', () => {
    it('renders modal with title', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByTestId('whats-new-modal')).toBeInTheDocument();
        expect(screen.getByText("What's New")).toBeInTheDocument();
    });

    it('displays version badge', () => {
        render(<WhatsNewModal version="0.1.0" changelog={mockChangelog} onDismiss={vi.fn()} />);
        expect(screen.getByText('v0.1.0')).toBeInTheDocument();
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
});
