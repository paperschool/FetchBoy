import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TopBar } from './TopBar';
import type { Environment } from '@/lib/db';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockSetActiveEnvironment, mockStoreState } = vi.hoisted(() => {
    const mockStoreState = {
        environments: [] as Environment[],
        activeEnvironmentId: null as string | null,
        setActive: vi.fn(),
    };
    return {
        mockSetActiveEnvironment: vi.fn(),
        mockStoreState,
    };
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/environments', () => ({
    setActiveEnvironment: (...args: unknown[]) => mockSetActiveEnvironment(...args),
}));

vi.mock('@/stores/environmentStore', () => ({
    useEnvironmentStore: Object.assign(
        (selector?: (s: typeof mockStoreState) => unknown) =>
            selector ? selector(mockStoreState) : mockStoreState,
        {
            getState: () => mockStoreState,
        },
    ),
}));

vi.mock('@/components/EnvironmentPanel/EnvironmentPanel', () => ({
    EnvironmentPanel: ({ open }: { open: boolean }) =>
        open ? <div data-testid="environment-panel-mock" /> : null,
}));

vi.mock('@/components/Settings/SettingsPanel', () => ({
    SettingsPanel: ({ open }: { open: boolean }) =>
        open ? <div data-testid="settings-panel-mock" /> : null,
}));

const makeEnv = (overrides: Partial<Environment> = {}): Environment => ({
    id: crypto.randomUUID(),
    name: 'Dev',
    variables: [],
    is_active: false,
    created_at: new Date().toISOString(),
    ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TopBar', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStoreState.environments = [];
        mockStoreState.activeEnvironmentId = null;
        mockSetActiveEnvironment.mockResolvedValue(undefined);
    });

    it('renders the app name', () => {
        render(<TopBar />);
        expect(screen.getByText('Fetch Boy 🦴')).toBeInTheDocument();
    });

    it('renders the environment selector with "No Environment" as default option', () => {
        render(<TopBar />);
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'No Environment' })).toBeInTheDocument();
    });

    it('renders environment options when environments exist', () => {
        mockStoreState.environments = [
            makeEnv({ id: 'e1', name: 'Development' }),
            makeEnv({ id: 'e2', name: 'Production' }),
        ];
        render(<TopBar />);
        expect(screen.getByRole('option', { name: 'Development' })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: 'Production' })).toBeInTheDocument();
    });

    it('calls setActiveEnvironment and store.setActive when selector changes', async () => {
        mockStoreState.environments = [makeEnv({ id: 'e1', name: 'Dev' })];
        render(<TopBar />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'e1' } });
        await waitFor(() => {
            expect(mockSetActiveEnvironment).toHaveBeenCalledWith('e1');
            expect(mockStoreState.setActive).toHaveBeenCalledWith('e1');
        });
    });

    it('calls setActiveEnvironment(null) when "No Environment" is selected', async () => {
        mockStoreState.environments = [makeEnv({ id: 'e1', name: 'Dev', is_active: true })];
        mockStoreState.activeEnvironmentId = 'e1';
        render(<TopBar />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: '' } });
        await waitFor(() => {
            expect(mockSetActiveEnvironment).toHaveBeenCalledWith(null);
            expect(mockStoreState.setActive).toHaveBeenCalledWith(null);
        });
    });

    it('opens EnvironmentPanel when manage button is clicked', () => {
        render(<TopBar />);
        const manageBtn = screen.getByRole('button', { name: /manage environments/i });
        fireEvent.click(manageBtn);
        expect(screen.getByTestId('environment-panel-mock')).toBeInTheDocument();
    });

    it('renders Open settings button with correct aria-label', () => {
        render(<TopBar />);
        expect(screen.getByRole('button', { name: /open settings/i })).toBeInTheDocument();
    });

    it('clicking Open settings button opens SettingsPanel', () => {
        render(<TopBar />);
        const settingsBtn = screen.getByRole('button', { name: /open settings/i });
        fireEvent.click(settingsBtn);
        expect(screen.getByTestId('settings-panel-mock')).toBeInTheDocument();
    });
});

