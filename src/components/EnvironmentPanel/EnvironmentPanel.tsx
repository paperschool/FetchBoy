import { useEffect, useState } from 'react';
import { Download, Globe, Trash2, Upload } from 'lucide-react';
import { save, open as openDialog } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import {
    createEnvironment,
    deleteEnvironment,
    renameEnvironment,
    updateEnvironmentVariables,
} from '@/lib/environments';
import { exportEnvironmentToJson, importEnvironmentFromJson } from '@/lib/importExport';
import { useEnvironmentStore } from '@/stores/environmentStore';
import type { KeyValuePair } from '@/lib/db';

interface EnvironmentPanelProps {
    open: boolean;
    onClose: () => void;
}

export function EnvironmentPanel({ open, onClose }: EnvironmentPanelProps) {
    const environments = useEnvironmentStore((s) => s.environments);
    const storeAddEnvironment = useEnvironmentStore((s) => s.addEnvironment);
    const storeRenameEnvironment = useEnvironmentStore((s) => s.renameEnvironment);
    const storeDeleteEnvironment = useEnvironmentStore((s) => s.deleteEnvironment);
    const storeUpdateVariables = useEnvironmentStore((s) => s.updateVariables);
    const pendingVariable = useEnvironmentStore((s) => s.pendingVariable);
    const activeEnvironmentId = useEnvironmentStore((s) => s.activeEnvironmentId);
    const clearPendingVariable = useEnvironmentStore((s) => s.clearPendingVariable);

    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Auto-select active environment and add pending variable when opened via quick-add.
    useEffect(() => {
        if (!pendingVariable) return;
        const targetEnvId = activeEnvironmentId ?? environments[0]?.id ?? null;
        if (!targetEnvId) { clearPendingVariable(); return; }

        setSelectedEnvId(targetEnvId);
        const env = environments.find((e) => e.id === targetEnvId);
        if (env && !env.variables.some((v) => v.key === pendingVariable)) {
            const updated = [...env.variables, { key: pendingVariable, value: '', enabled: true }];
            void updateEnvironmentVariables(targetEnvId, updated).then(() => {
                storeUpdateVariables(targetEnvId, updated);
            });
        }
        clearPendingVariable();
    }, [pendingVariable, activeEnvironmentId, environments, storeUpdateVariables, clearPendingVariable]);

    if (!open) return null;

    const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? null;

    // ─── Environment list handlers ────────────────────────────────────────────

    async function handleNewEnvironment() {
        const env = await createEnvironment('New Environment');
        storeAddEnvironment(env);
        setSelectedEnvId(env.id);
    }

    function handleDeleteEnvironment(id: string, _name: string) {
        if (!window.confirm('Delete this environment?')) return;
        void deleteEnvironment(id).then(() => {
            storeDeleteEnvironment(id);
            if (selectedEnvId === id) setSelectedEnvId(null);
        });
    }

    async function handleExportEnvironment(id: string, name: string) {
        const envs = useEnvironmentStore.getState().environments;
        try {
            const json = exportEnvironmentToJson(id, envs);
            const path = await save({
                defaultPath: `${name.replace(/[^a-z0-9]/gi, '_')}.fetchboy`,
                filters: [{ name: 'Fetchboy Environment', extensions: ['fetchboy'] }],
            });
            if (path) await writeTextFile(path, json);
        } catch (err) {
            window.alert(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    async function handleImportEnvironment() {
        try {
            const selected = await openDialog({
                multiple: false,
                filters: [{ name: 'Fetchboy Environment', extensions: ['fetchboy'] }],
            });
            if (!selected) return;
            const path = typeof selected === 'string' ? selected : selected[0];
            const text = await readTextFile(path);
            const env = await importEnvironmentFromJson(text);
            storeAddEnvironment(env);
            window.alert(`Imported environment '${env.name}' — ${env.variables.length} variable(s).`);
        } catch (err) {
            window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    function handleStartRename(id: string, currentName: string) {
        setRenamingId(id);
        setRenameValue(currentName);
    }

    function handleCommitRename(id: string) {
        if (renameValue.trim()) {
            void renameEnvironment(id, renameValue.trim()).then(() => {
                storeRenameEnvironment(id, renameValue.trim());
            });
        }
        setRenamingId(null);
    }

    // ─── Variable editor handlers ─────────────────────────────────────────────

    function saveVariables(envId: string, variables: KeyValuePair[]) {
        void updateEnvironmentVariables(envId, variables).then(() => {
            storeUpdateVariables(envId, variables);
        });
    }

    function handleVariableChange(
        index: number,
        field: keyof KeyValuePair,
        value: string | boolean,
    ) {
        if (!selectedEnv) return;
        const updated = selectedEnv.variables.map((v, i) =>
            i === index ? { ...v, [field]: value } : v,
        );
        saveVariables(selectedEnv.id, updated);
    }

    function handleAddVariable() {
        if (!selectedEnv) return;
        const updated = [...selectedEnv.variables, { key: '', value: '', enabled: true }];
        saveVariables(selectedEnv.id, updated);
    }

    function handleDeleteVariable(index: number) {
        if (!selectedEnv) return;
        const updated = selectedEnv.variables.filter((_, i) => i !== index);
        saveVariables(selectedEnv.id, updated);
    }

    return (
        <div
            data-testid="env-panel-backdrop"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={onClose}
        >
            <div
                className="bg-app-main border border-app-subtle max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-app-subtle px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Globe size={22} className="text-app-primary" />
                        <h2 className="text-app-primary font-semibold text-base">Environments</h2>
                    </div>
                    <button
                        aria-label="Close environments"
                        onClick={onClose}
                        className="text-app-primary opacity-60 hover:opacity-100 text-lg leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="flex gap-0 overflow-hidden" style={{ height: '60vh' }}>
                    {/* Left pane — environment list */}
                    <div className="flex w-56 flex-shrink-0 flex-col border-r border-app-subtle">
                        <div className="flex-1 overflow-y-auto p-2">
                            {environments.length === 0 ? (
                                <p className="text-app-muted mt-4 text-center text-xs">
                                    No environments yet.
                                </p>
                            ) : (
                                environments.map((env) => (
                                    <div
                                        key={env.id}
                                        data-testid={`env-row-${env.id}`}
                                        className={`group mb-1 flex cursor-pointer items-center gap-1 rounded px-2 py-1.5 text-xs ${
                                            selectedEnvId === env.id
                                                ? 'bg-gray-200 dark:bg-gray-700 text-app-primary'
                                                : 'text-app-muted hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-app-primary'
                                        }`}
                                        onClick={() => setSelectedEnvId(env.id)}
                                    >
                                        {renamingId === env.id ? (
                                            <input
                                                autoFocus
                                                className="bg-transparent text-app-primary w-full border-b border-app-subtle text-xs outline-none"
                                                value={renameValue}
                                                onChange={(e) => setRenameValue(e.target.value)}
                                                onBlur={() => handleCommitRename(env.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCommitRename(env.id);
                                                    if (e.key === 'Escape') setRenamingId(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span
                                                className="flex-1 truncate"
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartRename(env.id, env.name);
                                                }}
                                            >
                                                {env.name}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`Export ${env.name}`}
                                            title="Export environment"
                                            className="p-1 text-app-muted hover:text-app-primary rounded cursor-pointer flex-shrink-0 opacity-0 group-hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                void handleExportEnvironment(env.id, env.name);
                                            }}
                                        >
                                            <Download size={14} />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label={`Delete ${env.name}`}
                                            className="p-1 text-app-muted hover:text-red-500 rounded cursor-pointer ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEnvironment(env.id, env.name);
                                            }}
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="border-t border-app-subtle p-2">
                            <div className="flex gap-1">
                                <button
                                    className="text-app-muted hover:text-app-primary flex-1 rounded px-2 py-1 text-left text-xs"
                                    onClick={handleNewEnvironment}
                                >
                                    + New Environment
                                </button>
                                <button
                                    className="text-app-muted hover:text-app-primary rounded p-1 text-xs"
                                    title="Import environment"
                                    aria-label="Import environment"
                                    onClick={() => void handleImportEnvironment()}
                                >
                                    <Upload size={14} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right pane — variable editor */}
                    <div className="flex flex-1 flex-col overflow-hidden p-3">
                        {!selectedEnv ? (
                            <p className="text-app-muted m-auto text-center text-xs">
                                Select an environment to edit its variables.
                            </p>
                        ) : (
                            <>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-app-primary text-xs font-medium">
                                        {selectedEnv.name}
                                    </span>
                                    <button
                                        className="border border-app-subtle text-app-secondary rounded-md px-2 py-1 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                        onClick={handleAddVariable}
                                    >
                                        + Add Variable
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {/* Table header */}
                                    <div className="mb-1 grid grid-cols-[1fr_1fr_28px_24px] gap-1">
                                        <span className="text-app-secondary text-xs">Key</span>
                                        <span className="text-app-secondary text-xs">Value</span>
                                        <span className="text-app-secondary text-xs text-center">On</span>
                                        <span />
                                    </div>
                                    {selectedEnv.variables.map((variable, i) => (
                                        <div
                                            key={i}
                                            className="mb-1 grid grid-cols-[1fr_1fr_28px_24px] items-center gap-1"
                                        >
                                            <input
                                                aria-label={`Variable key ${i}`}
                                                className="-app-subtle text-app-primary h-7 rounded border bg-transparent px-2 text-xs"
                                                value={variable.key}
                                                onChange={(e) =>
                                                    handleVariableChange(i, 'key', e.target.value)
                                                }
                                            />
                                            <input
                                                aria-label={`Variable value ${i}`}
                                                className="border-app-subtle text-app-primary h-7 rounded border bg-transparent px-2 text-xs"
                                                value={variable.value}
                                                onChange={(e) =>
                                                    handleVariableChange(i, 'value', e.target.value)
                                                }
                                            />
                                            <input
                                                type="checkbox"
                                                aria-label={`Variable enabled ${i}`}
                                                checked={variable.enabled}
                                                className="mx-auto h-5 w-5 cursor-pointer"
                                                onChange={(e) =>
                                                    handleVariableChange(i, 'enabled', e.target.checked)
                                                }
                                            />
                                            <button
                                                type="button"
                                                aria-label={`Delete variable ${i}`}
                                                className="p-1 text-app-muted hover:text-red-400 rounded cursor-pointer"
                                                onClick={() => handleDeleteVariable(i)}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedEnv.variables.length === 0 && (
                                        <p className="text-app-muted mt-2 text-center text-xs">
                                            No variables yet.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
