import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ScriptTemplate } from '@/lib/scriptTemplates';

// Mock the DB layer so the store's CRUD doesn't touch tauri-plugin-sql.
vi.mock('@/lib/scriptTemplates', () => ({
    loadScriptTemplates: vi.fn(async () => []),
    createScriptTemplate: vi.fn(async (name: string, code: string, description = '') => ({
        id: `tpl-${name}`, name, code, description, created_at: 'ts', updated_at: 'ts',
    })),
    updateScriptTemplate: vi.fn(async () => {}),
    deleteScriptTemplate: vi.fn(async () => {}),
}));
vi.mock('@/lib/collections', () => ({
    clearPreRequestTemplateLinks: vi.fn(async () => {}),
}));

import { useScriptTemplateStore } from './scriptTemplateStore';

const reset = () => useScriptTemplateStore.setState({ templates: [], isLoaded: false });

describe('scriptTemplateStore round-trip (20.7)', () => {
    beforeEach(reset);

    it('create appends a template', async () => {
        const created = await useScriptTemplateStore.getState().create('Auth', 'fb.env.set("t","1")');
        expect(created.name).toBe('Auth');
        const { templates } = useScriptTemplateStore.getState();
        expect(templates).toHaveLength(1);
        expect(templates[0].code).toBe('fb.env.set("t","1")');
    });

    it('update mutates the template in place', async () => {
        const created = await useScriptTemplateStore.getState().create('Auth', 'old');
        await useScriptTemplateStore.getState().update(created.id, { code: 'new', name: 'Auth2' });
        const tpl = useScriptTemplateStore.getState().templates.find((t) => t.id === created.id) as ScriptTemplate;
        expect(tpl.code).toBe('new');
        expect(tpl.name).toBe('Auth2');
    });

    it('remove drops the template', async () => {
        const created = await useScriptTemplateStore.getState().create('Auth', 'x');
        await useScriptTemplateStore.getState().remove(created.id);
        expect(useScriptTemplateStore.getState().templates).toHaveLength(0);
    });
});
