import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ScriptWorkspace } from './ScriptWorkspace';
import {
    useTabStore,
    createDefaultRequestSnapshot,
    createDefaultResponseSnapshot,
    createDefaultScriptDebugState,
    type TabEntry,
} from '@/stores/tabStore';
import { useScriptTemplateStore } from '@/stores/scriptTemplateStore';
import { useCollectionStore } from '@/stores/collectionStore';
import { useScriptWorkspaceStore } from '@/stores/scriptWorkspaceStore';
import type { ScriptTemplate } from '@/lib/scriptTemplates';
import type { Collection, Request } from '@/lib/db';

// Monaco can't run in jsdom — mock the editor as a textarea so we can drive onChange.
vi.mock('@/components/Editor/MonacoEditorField', () => ({
    MonacoEditorField: ({
        value,
        onChange,
        testId,
    }: {
        value: string;
        onChange?: (v: string) => void;
        testId: string;
    }) => (
        <textarea
            data-testid={testId}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
        />
    ),
}));

const makeTab = (id: string, preRequestScript: string): TabEntry => ({
    id,
    label: `Tab ${id}`,
    isCustomLabel: false,
    requestState: { ...createDefaultRequestSnapshot(), preRequestScript },
    responseState: createDefaultResponseSnapshot(),
    scriptDebugState: createDefaultScriptDebugState(),
});

// isLoaded:true so ScriptTemplatePanel's mount-load no-ops (no DB in jsdom).
const seedTemplates = (templates: ScriptTemplate[] = []) =>
    useScriptTemplateStore.setState({ templates, isLoaded: true });

describe('ScriptWorkspace pre-request binding (20.5)', () => {
    beforeEach(() => {
        seedTemplates();
        useTabStore.setState({
            tabs: [makeTab('a', 'scriptA'), makeTab('b', 'scriptB')],
            activeTabId: 'a',
        });
    });

    it('mounts the sidebar + editor regions', () => {
        render(<ScriptWorkspace />);
        expect(screen.getByTestId('script-workspace-sidebar')).toBeInTheDocument();
        expect(screen.getByTestId('script-workspace-editor')).toBeInTheDocument();
    });

    it('binds the editor to the active request’s pre_request_script', () => {
        render(<ScriptWorkspace />);
        const editor = screen.getByTestId('workspace-pre-request-editor') as HTMLTextAreaElement;
        expect(editor.value).toBe('scriptA');
    });

    it('editing mutates the active tab snapshot and marks it dirty', () => {
        render(<ScriptWorkspace />);
        const editor = screen.getByTestId('workspace-pre-request-editor');
        fireEvent.change(editor, { target: { value: 'edited!' } });

        const tabA = useTabStore.getState().tabs.find((t) => t.id === 'a')!;
        expect(tabA.requestState.preRequestScript).toBe('edited!');
        expect(tabA.requestState.isDirty).toBe(true);
    });

    it('switching the active request swaps the edited script', () => {
        render(<ScriptWorkspace />);
        expect((screen.getByTestId('workspace-pre-request-editor') as HTMLTextAreaElement).value).toBe('scriptA');

        act(() => {
            useTabStore.getState().setActiveTab('b');
        });

        expect((screen.getByTestId('workspace-pre-request-editor') as HTMLTextAreaElement).value).toBe('scriptB');
    });

    it('shows the empty state when there is no active tab', () => {
        act(() => {
            useTabStore.setState({ tabs: [], activeTabId: 'missing' });
        });
        render(<ScriptWorkspace />);
        expect(screen.getByTestId('script-workspace-empty')).toBeInTheDocument();
    });
});

describe('ScriptWorkspace template management (20.7)', () => {
    const tmpl: ScriptTemplate = {
        id: 'tpl-1', name: 'Auth header', description: '', code: 'fb.env.set("token","abc")',
        created_at: 'ts', updated_at: 'ts',
    };

    beforeEach(() => {
        seedTemplates([tmpl]);
        // empty active script so "apply" doesn't trigger the replace-confirm
        useTabStore.setState({ tabs: [makeTab('a', '')], activeTabId: 'a' });
    });

    it('clicking a template row opens it in the editor', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: /Auth header/i }));
        const editor = screen.getByTestId('workspace-template-editor') as HTMLTextAreaElement;
        expect(editor.value).toBe('fb.env.set("token","abc")');
    });

    it('applies an opened template into the active request’s pre-request script + marks dirty', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: /Auth header/i })); // open in editor
        fireEvent.click(screen.getByRole('button', { name: 'Apply to request' }));
        const tabA = useTabStore.getState().tabs.find((t) => t.id === 'a')!;
        expect(tabA.requestState.preRequestScript).toBe('fb.env.set("token","abc")');
        expect(tabA.requestState.isDirty).toBe(true);
    });
});

describe('ScriptWorkspace pre/post mode switch (20.9)', () => {
    beforeEach(() => {
        seedTemplates();
        const tab = makeTab('a', 'PRE');
        tab.requestState.postResponseScript = 'POST';
        useTabStore.setState({ tabs: [tab], activeTabId: 'a' });
    });

    it('defaults to pre-request and binds the pre-request script', () => {
        render(<ScriptWorkspace />);
        expect((screen.getByTestId('workspace-pre-request-editor') as HTMLTextAreaElement).value).toBe('PRE');
    });

    it('switching to post-response binds the post-response script', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: 'Post-response' }));
        expect((screen.getByTestId('workspace-post-response-editor') as HTMLTextAreaElement).value).toBe('POST');
    });

    it('editing in post-response mode writes postResponseScript, not preRequestScript', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: 'Post-response' }));
        fireEvent.change(screen.getByTestId('workspace-post-response-editor'), { target: { value: 'fb.test("x", function(){})' } });
        const tab = useTabStore.getState().tabs.find((t) => t.id === 'a')!;
        expect(tab.requestState.postResponseScript).toBe('fb.test("x", function(){})');
        expect(tab.requestState.preRequestScript).toBe('PRE'); // unchanged
    });
});

describe('ScriptWorkspace deep-link (Open in Script Editor)', () => {
    afterEach(() => useScriptWorkspaceStore.getState().setPendingMode(null));

    beforeEach(() => {
        seedTemplates();
        const tab = makeTab('a', 'PRE');
        tab.requestState.postResponseScript = 'POST';
        useTabStore.setState({ tabs: [tab], activeTabId: 'a' });
    });

    it('opens to the slot requested via the workspace store', () => {
        useScriptWorkspaceStore.getState().setPendingMode('post');
        render(<ScriptWorkspace />);
        expect(screen.getByTestId('workspace-post-response-editor')).toBeInTheDocument();
        // pendingMode is consumed (cleared) once applied.
        expect(useScriptWorkspaceStore.getState().pendingMode).toBeNull();
    });
});

describe('ScriptWorkspace collection-wide (global) slot', () => {
    afterEach(() => {
        useCollectionStore.setState({ collections: [], folders: [], requests: [], activeRequestId: null });
    });

    beforeEach(() => {
        seedTemplates();
        const tab = makeTab('a', 'PRE');
        tab.requestState.savedRequestId = 'req1';
        useTabStore.setState({ tabs: [tab], activeTabId: 'a' });
        const col = { id: 'col1', name: 'My Coll', description: '', default_environment_id: null, pre_request_script: 'GLOBAL_CODE', pre_request_script_enabled: true, created_at: 'ts', updated_at: 'ts' } as Collection;
        const req = { id: 'req1', collection_id: 'col1', folder_id: null, name: 'My Request' } as Request;
        useCollectionStore.setState({ collections: [col], folders: [], requests: [req], activeRequestId: 'req1' });
    });

    it('shows the Global slot and binds it to the collection script', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: 'Global' }));
        expect((screen.getByTestId('workspace-global-editor') as HTMLTextAreaElement).value).toBe('GLOBAL_CODE');
    });

    it('editing the global slot updates the collection in the store', () => {
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: 'Global' }));
        fireEvent.change(screen.getByTestId('workspace-global-editor'), { target: { value: 'NEW_GLOBAL' } });
        expect(useCollectionStore.getState().collections[0].pre_request_script).toBe('NEW_GLOBAL');
    });
});

describe('ScriptWorkspace run + output panel (UX)', () => {
    beforeEach(() => {
        seedTemplates();
        useTabStore.setState({ tabs: [makeTab('a', 'console.log("from-run");')], activeTabId: 'a' });
    });

    it('runs the pre-request script and shows console output', async () => {
        render(<ScriptWorkspace />);
        expect(screen.queryByTestId('script-workspace-output')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByTestId('script-workspace-output')).toBeInTheDocument();
        expect(await screen.findByText(/from-run/)).toBeInTheDocument();
    });

    it('gives feedback (not a silent no-op) when running an empty script', async () => {
        useTabStore.setState({ tabs: [makeTab('a', '   ')], activeTabId: 'a' });
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByText(/Nothing to run/i)).toBeInTheDocument();
    });

    it('can run a template from the template editor', async () => {
        seedTemplates([{ id: 't1', name: 'Greeter', description: '', code: 'console.log("tpl-run");', created_at: 'ts', updated_at: 'ts' }]);
        render(<ScriptWorkspace />);
        fireEvent.click(screen.getByRole('button', { name: /Greeter/i })); // open template row
        fireEvent.click(screen.getByRole('button', { name: 'Run' }));
        expect(await screen.findByText(/tpl-run/)).toBeInTheDocument();
    });
});
