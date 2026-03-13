import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useBreakpointsStore } from '@/stores/breakpointsStore';
import type { Breakpoint, BreakpointFolder } from '@/lib/db';
import { BreakpointsTree } from './BreakpointsTree';

// ─── Mock DB lib ──────────────────────────────────────────────────────────────

const mockLoadAllBreakpoints = vi.fn();
const mockCreateBreakpointFolder = vi.fn();
const mockRenameBreakpointFolder = vi.fn();
const mockDeleteBreakpointFolder = vi.fn();
const mockCreateBreakpoint = vi.fn();
const mockDeleteBreakpoint = vi.fn();

vi.mock('@/lib/breakpoints', () => ({
    loadAllBreakpoints: () => mockLoadAllBreakpoints(),
    createBreakpointFolder: (...a: unknown[]) => mockCreateBreakpointFolder(...a),
    renameBreakpointFolder: (...a: unknown[]) => mockRenameBreakpointFolder(...a),
    deleteBreakpointFolder: (...a: unknown[]) => mockDeleteBreakpointFolder(...a),
    createBreakpoint: (...a: unknown[]) => mockCreateBreakpoint(...a),
    deleteBreakpoint: (...a: unknown[]) => mockDeleteBreakpoint(...a),
    syncBreakpointsToProxy: vi.fn().mockResolvedValue(undefined),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const mockFolder: BreakpointFolder = {
    id: 'f1',
    name: 'API Tests',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

const mockBreakpoint: Breakpoint = {
    id: 'b1',
    folder_id: 'f1',
    name: 'Get Users',
    url_pattern: '*/api/users*',
    match_type: 'wildcard',
    enabled: true,
    response_mapping_enabled: false,
    response_mapping_body: '',
    response_mapping_content_type: 'application/json',
    status_code_enabled: false,
    status_code_value: 200,
    custom_headers: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAllBreakpoints.mockResolvedValue({ folders: [], breakpoints: [] });
    // Reset store state
    useBreakpointsStore.setState({ folders: [], breakpoints: [] });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BreakpointsTree', () => {
    it('renders empty state when no breakpoints exist', () => {
        render(<BreakpointsTree />);
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText(/No breakpoints yet/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create Folder' })).toBeInTheDocument();
    });

    it('renders folder with breakpoints when store has data', () => {
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [mockBreakpoint] });
        render(<BreakpointsTree />);
        expect(screen.getByText('API Tests')).toBeInTheDocument();
    });

    it('does not render breakpoints initially (folder collapsed)', () => {
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [mockBreakpoint] });
        render(<BreakpointsTree />);
        expect(screen.queryByText('Get Users')).not.toBeInTheDocument();
    });

    it('expands folder and shows breakpoints on toggle click', () => {
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [mockBreakpoint] });
        render(<BreakpointsTree />);
        fireEvent.click(screen.getByRole('button', { name: 'Expand folder' }));
        expect(screen.getByText('Get Users')).toBeInTheDocument();
    });

    it('collapses folder on second toggle click', () => {
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [mockBreakpoint] });
        render(<BreakpointsTree />);
        const toggleBtn = screen.getByRole('button', { name: 'Expand folder' });
        fireEvent.click(toggleBtn);
        expect(screen.getByText('Get Users')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Collapse folder' }));
        expect(screen.queryByText('Get Users')).not.toBeInTheDocument();
    });

    it('calls deleteBreakpointFolder and updates store when folder deleted', async () => {
        mockDeleteBreakpointFolder.mockResolvedValue(undefined);
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [] });
        render(<BreakpointsTree />);
        // Hover over folder row to reveal delete button
        const folderEl = screen.getByTestId('bp-folder-f1');
        // Fire mouseOver to trigger group-hover visibility (jsdom doesn't do CSS hover, use aria)
        const deleteBtn = folderEl.querySelector('[aria-label="Delete folder"]') as HTMLElement;
        fireEvent.click(deleteBtn);
        expect(mockDeleteBreakpointFolder).toHaveBeenCalledWith('f1');
    });

    it('calls deleteBreakpoint and updates store when breakpoint deleted', async () => {
        mockDeleteBreakpoint.mockResolvedValue(undefined);
        useBreakpointsStore.setState({ folders: [mockFolder], breakpoints: [mockBreakpoint] });
        render(<BreakpointsTree />);
        // Expand folder first
        fireEvent.click(screen.getByRole('button', { name: 'Expand folder' }));
        const bpEl = screen.getByTestId('breakpoint-b1');
        const deleteBtn = bpEl.querySelector('[aria-label="Delete breakpoint"]') as HTMLElement;
        fireEvent.click(deleteBtn);
        expect(mockDeleteBreakpoint).toHaveBeenCalledWith('b1');
    });
});
