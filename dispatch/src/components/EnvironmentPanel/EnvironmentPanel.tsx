import { useState } from 'react';
import {
    createEnvironment,
    deleteEnvironment,
    renameEnvironment,
    updateEnvironmentVariables,
} from '@/lib/environments';
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

    const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    if (!open) return null;

    const selectedEnv = environments.find((e) => e.id === selectedEnvId) ?? null;

    // ─── Environment list handlers ────────────────────────────────────────────

    async function handleNewEnvironment() {
        const env = await createEnvironment('New Environment');
        storeAddEnvironment(env);
        setSelectedEnvId(env.id);
    }

    function handleDeleteEnvironment(id: string, name: string) {
        if (!window.confirm('Delete this environment?')) return;
        void deleteEnvironment(id).then(() => {
            storeDeleteEnvironment(id);
            if (selectedEnvId === id) setSelectedEnvId(null);
        });
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
                className="bg-app-sidebar max-h-[80vh] w-full max-w-2xl overflow-hidden rounded shadow-lg"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <h2 className="text-app-inverse text-sm font-semibold">Environments</h2>
                    <button
                        aria-label="Close"
                        className="text-app-muted hover:text-app-inverse text-xs"
                        onClick={onClose}
                    >
                        ✕ Close
                    </button>
                </div>

                {/* Body */}
                <div className="flex gap-0 overflow-hidden" style={{ height: '60vh' }}>
                    {/* Left pane — environment list */}
                    <div className="flex w-56 flex-shrink-0 flex-col border-r border-white/10">
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
                                                ? 'bg-gray-700 text-app-inverse'
                                                : 'text-app-muted hover:bg-gray-700 hover:text-app-inverse'
                                        }`}
                                        onClick={() => setSelectedEnvId(env.id)}
                                    >
                                        {renamingId === env.id ? (
                                            <input
                                                autoFocus
                                                className="bg-transparent text-app-inverse w-full border-b border-white/30 text-xs outline-none"
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
                                            aria-label={`Delete ${env.name}`}
                                            className="text-app-muted hover:text-red-400 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteEnvironment(env.id, env.name);
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="border-t border-white/10 p-2">
                            <button
                                className="text-app-muted hover:text-app-inverse w-full rounded px-2 py-1 text-left text-xs"
                                onClick={handleNewEnvironment}
                            >
                                + New Environment
                            </button>
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
                                    <span className="text-app-inverse text-xs font-medium">
                                        {selectedEnv.name}
                                    </span>
                                    <button
                                        className="text-app-muted hover:text-app-inverse text-xs"
                                        onClick={handleAddVariable}
                                    >
                                        Add Variable
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto">
                                    {/* Table header */}
                                    <div className="mb-1 grid grid-cols-[1fr_1fr_2rem_2rem] gap-1 px-1">
                                        <span className="text-app-muted text-xs">Key</span>
                                        <span className="text-app-muted text-xs">Value</span>
                                        <span className="text-app-muted text-xs text-center">On</span>
                                        <span />
                                    </div>
                                    {selectedEnv.variables.map((variable, i) => (
                                        <div
                                            key={i}
                                            className="mb-1 grid grid-cols-[1fr_1fr_2rem_2rem] items-center gap-1"
                                        >
                                            <input
                                                aria-label={`Variable key ${i}`}
                                                className="border-app-subtle text-app-primary h-7 rounded border bg-transparent px-2 text-xs"
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
                                                className="mx-auto"
                                                onChange={(e) =>
                                                    handleVariableChange(i, 'enabled', e.target.checked)
                                                }
                                            />
                                            <button
                                                aria-label={`Delete variable ${i}`}
                                                className="text-app-muted hover:text-red-400 text-xs"
                                                onClick={() => handleDeleteVariable(i)}
                                            >
                                                ×
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
