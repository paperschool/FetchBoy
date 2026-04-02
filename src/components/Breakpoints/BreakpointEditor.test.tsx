import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BreakpointEditor } from './BreakpointEditor';
import { useBreakpointsStore, validateUrlPattern } from '@/stores/breakpointsStore';
import type { EditForm } from '@/stores/breakpointsStore';

// ─── Mock breakpoints lib (used by saveBreakpoint in store) ───────────────────

const mockCreateBreakpoint = vi.fn();
const mockUpdateBreakpoint = vi.fn();

vi.mock('@/lib/breakpoints', () => ({
    loadAllBreakpoints: vi.fn().mockResolvedValue({ folders: [], breakpoints: [] }),
    createBreakpointFolder: vi.fn(),
    renameBreakpointFolder: vi.fn(),
    deleteBreakpointFolder: vi.fn(),
    createBreakpoint: (...a: unknown[]) => mockCreateBreakpoint(...a),
    updateBreakpoint: (...a: unknown[]) => mockUpdateBreakpoint(...a),
    deleteBreakpoint: vi.fn(),
    syncBreakpointsToProxy: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const newBreakpointForm: EditForm = {
    id: null,
    name: 'New Breakpoint',
    urlPattern: '',
    matchType: 'partial',
    enabled: true,
    folderId: null,
    responseMappingEnabled: false,
    responseMappingBody: '',
    responseMappingContentType: 'application/json',
    statusCodeEnabled: false,
    statusCodeValue: 200,
    customHeaders: [],
};

const editBreakpointForm: EditForm = {
    id: 'bp-123',
    name: 'Get Users',
    urlPattern: '*/api/users*',
    matchType: 'wildcard',
    enabled: true,
    folderId: 'folder-1',
    responseMappingEnabled: false,
    responseMappingBody: '',
    responseMappingContentType: 'application/json',
    statusCodeEnabled: false,
    statusCodeValue: 200,
    customHeaders: [],
};

beforeEach(() => {
    vi.clearAllMocks();
    useBreakpointsStore.setState({
        folders: [],
        breakpoints: [],
        isEditing: true,
        editForm: { ...newBreakpointForm },
        selectedBreakpointId: null,
    });
});

// ─── validateUrlPattern utility ───────────────────────────────────────────────

describe('validateUrlPattern', () => {
    it('returns error for empty pattern', () => {
        expect(validateUrlPattern('', 'exact')).toBe('URL pattern is required');
    });

    it('returns null for valid exact pattern', () => {
        expect(validateUrlPattern('https://api.example.com/users', 'exact')).toBeNull();
    });

    it('returns null for valid partial pattern', () => {
        expect(validateUrlPattern('api/users', 'partial')).toBeNull();
    });

    it('returns null for valid wildcard pattern', () => {
        expect(validateUrlPattern('*/api/users/*', 'wildcard')).toBeNull();
    });

    it('returns null for valid regex pattern', () => {
        expect(validateUrlPattern('^/api/users/\\d+$', 'regex')).toBeNull();
    });

    it('returns error for invalid regex pattern', () => {
        expect(validateUrlPattern('[invalid', 'regex')).toBe('Invalid regex pattern');
    });

    it('returns error for unclosed group regex', () => {
        expect(validateUrlPattern('(unclosed', 'regex')).toBe('Invalid regex pattern');
    });
});

// ─── BreakpointEditor component ───────────────────────────────────────────────

describe('BreakpointEditor', () => {
    it('renders "New Breakpoint" heading for new form', () => {
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByText('New Breakpoint')).toBeInTheDocument();
    });

    it('renders "Edit Breakpoint" heading when editing existing', () => {
        useBreakpointsStore.setState({ editForm: { ...editBreakpointForm } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByText('Edit Breakpoint')).toBeInTheDocument();
    });

    it('pre-fills name input from editForm', () => {
        useBreakpointsStore.setState({ editForm: { ...editBreakpointForm } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByTestId('bp-name-input')).toHaveValue('Get Users');
    });

    it('pre-fills URL pattern from editForm', () => {
        useBreakpointsStore.setState({ editForm: { ...editBreakpointForm } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByTestId('bp-url-input')).toHaveValue('*/api/users*');
    });

    it('save button is disabled when URL pattern is empty', () => {
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByTestId('bp-save-button')).toBeDisabled();
    });

    it('save button is enabled after entering a valid URL pattern', () => {
        render(<BreakpointEditor onClose={vi.fn()} />);
        fireEvent.change(screen.getByTestId('bp-url-input'), { target: { value: 'api/users' } });
        expect(screen.getByTestId('bp-save-button')).not.toBeDisabled();
    });

    it('shows validation error for invalid regex', () => {
        useBreakpointsStore.setState({ editForm: { ...newBreakpointForm, matchType: 'regex' } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        fireEvent.change(screen.getByTestId('bp-url-input'), { target: { value: '[invalid' } });
        expect(screen.getByTestId('bp-url-error')).toBeInTheDocument();
        expect(screen.getByText('Invalid regex pattern')).toBeInTheDocument();
    });

    it('save button is disabled when regex is invalid', () => {
        useBreakpointsStore.setState({ editForm: { ...newBreakpointForm, matchType: 'regex' } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        fireEvent.change(screen.getByTestId('bp-url-input'), { target: { value: '[' } });
        expect(screen.getByTestId('bp-save-button')).toBeDisabled();
    });

    it('clears regex error when switching to partial match type', () => {
        useBreakpointsStore.setState({ editForm: { ...newBreakpointForm, matchType: 'regex' } });
        render(<BreakpointEditor onClose={vi.fn()} />);
        fireEvent.change(screen.getByTestId('bp-url-input'), { target: { value: '[invalid' } });
        expect(screen.getByTestId('bp-url-error')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('bp-match-type-partial'));
        expect(screen.queryByTestId('bp-url-error')).not.toBeInTheDocument();
    });

    it('calls onClose when Cancel button is clicked', () => {
        const onClose = vi.fn();
        render(<BreakpointEditor onClose={onClose} />);
        fireEvent.click(screen.getByText('Cancel'));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls createBreakpoint when saving new breakpoint', async () => {
        const createdBp = {
            id: 'new-id',
            folder_id: null,
            name: 'Test BP',
            url_pattern: 'api/test',
            match_type: 'partial' as const,
            enabled: true,
            response_mapping_enabled: false,
            response_mapping_body: '',
            response_mapping_content_type: 'application/json',
            status_code_enabled: false,
            status_code_value: 200,
            custom_headers: [],
            created_at: '',
            updated_at: '',
        };
        mockCreateBreakpoint.mockResolvedValue(createdBp);
        mockUpdateBreakpoint.mockResolvedValue(undefined);
        const onClose = vi.fn();
        render(<BreakpointEditor onClose={onClose} />);
        fireEvent.change(screen.getByTestId('bp-name-input'), { target: { value: 'Test BP' } });
        fireEvent.change(screen.getByTestId('bp-url-input'), { target: { value: 'api/test' } });
        fireEvent.click(screen.getByTestId('bp-save-button'));
        await vi.waitFor(() => {
            expect(mockCreateBreakpoint).toHaveBeenCalledWith(null, 'Test BP', 'api/test', 'partial');
        });
    });

    it('calls updateBreakpoint when saving existing breakpoint', async () => {
        mockUpdateBreakpoint.mockResolvedValue(undefined);
        useBreakpointsStore.setState({ editForm: { ...editBreakpointForm } });
        const onClose = vi.fn();
        render(<BreakpointEditor onClose={onClose} />);
        fireEvent.click(screen.getByTestId('bp-save-button'));
        await vi.waitFor(() => {
            expect(mockUpdateBreakpoint).toHaveBeenCalledWith('bp-123', expect.objectContaining({
                name: 'Get Users',
                url_pattern: '*/api/users*',
                match_type: 'wildcard',
            }));
        });
    });

    it('renders all four match type buttons', () => {
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.getByTestId('bp-match-type-exact')).toBeInTheDocument();
        expect(screen.getByTestId('bp-match-type-partial')).toBeInTheDocument();
        expect(screen.getByTestId('bp-match-type-wildcard')).toBeInTheDocument();
        expect(screen.getByTestId('bp-match-type-regex')).toBeInTheDocument();
    });

    it('does not render a Response tab', () => {
        render(<BreakpointEditor onClose={vi.fn()} />);
        expect(screen.queryByText('Response')).not.toBeInTheDocument();
    });
});
