import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  loadScriptTemplates,
  createScriptTemplate,
  updateScriptTemplate,
  deleteScriptTemplate,
  type ScriptTemplate,
} from '@/lib/scriptTemplates';

interface ScriptTemplateStore {
  templates: ScriptTemplate[];
  isLoaded: boolean;
  load: () => Promise<void>;
  create: (name: string, code: string, description?: string) => Promise<ScriptTemplate>;
  update: (id: string, patch: Partial<Pick<ScriptTemplate, 'name' | 'description' | 'code'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useScriptTemplateStore = create<ScriptTemplateStore>()(
  immer((set, get) => ({
    templates: [],
    isLoaded: false,

    load: async () => {
      if (get().isLoaded) return;
      const templates = await loadScriptTemplates();
      set((state) => {
        state.templates = templates;
        state.isLoaded = true;
      });
    },

    create: async (name, code, description) => {
      const template = await createScriptTemplate(name, code, description);
      set((state) => { state.templates.push(template); });
      return template;
    },

    update: async (id, patch) => {
      await updateScriptTemplate(id, patch);
      set((state) => {
        const t = state.templates.find((tmpl) => tmpl.id === id);
        if (t) Object.assign(t, patch, { updated_at: new Date().toISOString() });
      });
    },

    remove: async (id) => {
      await deleteScriptTemplate(id);
      set((state) => {
        state.templates = state.templates.filter((t) => t.id !== id);
      });
    },
  })),
);
