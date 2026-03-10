import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnvironmentPanel } from './EnvironmentPanel';
import type { Environment } from '@/lib/db';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateEnvironment = vi.fn();
const mockDeleteEnvironment = vi.fn();
const mockRenameEnvironment = vi.fn();
const mockUpdateEnvironmentVariables = vi.fn();

vi.mock('@/lib/environments', () => ({
    createEnvironment: (...args: unknown[]) => mockCreateEnvironment(...args),
    deleteEnvironment: (...args: unknown[]) => mockDeleteEnvironment(...args),
    renameEnvironment: (...args: unknown[]) => mockRenameEnvironment(...args),
    updateEnvironmentVariables: (...args: unknown[]) => mockUpdateEnvironmentVariables(...args),
}));

const mockStoreState = {
    environments: [] as Environment[],
    activeEnvironmentId: null as string | null,
    loadAll: vi.fn(),
    addEnvironment: vi.fn(),
    renameEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
    updateVariables: vi.fn(),
    setActive: vi.fn(),
};

vi.mock('@/stores/environmentStore', () => ({
    useEnvironmentStore: (selector?: (s: typeof mockStoreState) => unknown) =>
        selector ? selector(mockStoreState) : mockStoreState,
}));

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
    id: crypto.randomUUID(),
    name: 'Test Env',
    variables: [],
    is_active: false,
    created_at: new Date().toISOString(),
    ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EnvironmentPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.environments = [];
        mockStoreState.activeEnvironmentId = null;
    });

    it('renders nothing when open=false', () => {
        const { container } = render(
            <EnvironmentPanel open={false} onClose={vi.fn()} />,
        );
        expect(container.firstChild).toBeNull();
    });

    it('shows "No environments yet." when open=true with empty environments', () => {
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        expect(screen.getByText('No environments yet.')).toBeInTheDocument();
    });

    it('renders environment rows when environments exist', () => {
        mockStoreState.environments = [
            makeEnv({ id: 'a', name: 'Dev' }),
            makeEnv({ id: 'b', name: 'Prod' }),
        ];
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        expect(screen.getByText('Dev')).toBeInTheDocument();
        expect(screen.getByText('Prod')).toBeInTheDocument();
    });

    it('calls createEnvironment and addEnvironment when "New Environment" is clicked', async () => {
        const newEnv = makeEnv({ id: 'new-id', name: 'New Environment' });
        mockCreateEnvironment.mockResolvedValue(newEnv);
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /new environment/i }));
        await waitFor(() => {
            expect(mockCreateEnvironment).toHaveBeenCalledWith('New Environment');
            expect(mockStoreState.addEnvironment).toHaveBeenCalledWith(newEnv);
        });
    });

    it('shows window.confirm when delete is clicked; confirms deletion', async () => {
        mockStoreState.environments = [makeEnv({ id: 'env-1', name: 'Dev' })];
        mockDeleteEnvironment.mockResolvedValue(undefined);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        const deleteBtn = screen.getByRole('button', { name: /delete dev/i });
        fireEvent.click(deleteBtn);
        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalled();
            expect(mockDeleteEnvironment).toHaveBeenCalledWith('env-1');
            expect(mockStoreState.deleteEnvironment).toHaveBeenCalledWith('env-1');
        });
    });

    it('does not call deleteEnvironment when window.confirm returns false', () => {
        mockStoreState.environments = [makeEnv({ id: 'env-1', name: 'Dev' })];
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        const deleteBtn = screen.getByRole('button', { name: /delete dev/i });
        fireEvent.click(deleteBtn);
        expect(mockDeleteEnvironment).not.toHaveBeenCalled();
    });

    it('shows variable editor after clicking an environment row', () => {
        mockStoreState.environments = [
            makeEnv({
                id: 'env-1',
                name: 'Dev',
                variables: [{ key: 'HOST', value: 'localhost', enabled: true }],
            }),
        ];
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByTestId('env-row-env-1'));
        expect(screen.getByDisplayValue('HOST')).toBeInTheDocument();
        expect(screen.getByDisplayValue('localhost')).toBeInTheDocument();
    });

    it('calls updateEnvironmentVariables and updateVariables when adding a variable', async () => {
        const env = makeEnv({ id: 'env-1', name: 'Dev', variables: [] });
        mockStoreState.environments = [env];
        mockUpdateEnvironmentVariables.mockResolvedValue(undefined);
        render(<EnvironmentPanel open={true} onClose={vi.fn()} />);
        // Select the environment
        fireEvent.click(screen.getByTestId('env-row-env-1'));
        // Add a variable
        fireEvent.click(screen.getByText('Add Variable'));
        await waitFor(() => {
            expect(mockUpdateEnvironmentVariables).toHaveBeenCalled();
            expect(mockStoreState.updateVariables).toHaveBeenCalled();
        });
    });

    it('calls onClose when the Close button is clicked', () => {
        const onClose = vi.fn();
        render(<EnvironmentPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
        expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when the backdrop is clicked', () => {
        const onClose = vi.fn();
        render(<EnvironmentPanel open={true} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('env-panel-backdrop'));
        expect(onClose).toHaveBeenCalled();
    });
});
