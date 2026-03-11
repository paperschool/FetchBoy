import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';

export interface ChangelogEntry {
    version: string;
    date: string;
    changes: string[];
}

interface WhatsNewModalProps {
    version: string;
    changelog: ChangelogEntry[];
    onDismiss: () => void;
}

export function WhatsNewModal({ version, changelog, onDismiss }: WhatsNewModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onDismiss();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onDismiss]);

    const latestChanges = changelog[0];

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            data-testid="whats-new-overlay"
        >
            <div
                className="bg-app-main border border-app-subtle rounded-lg p-6 w-[480px] shadow-xl"
                data-testid="whats-new-modal"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-amber-500" size={24} />
                        <h2 className="text-app-primary font-semibold text-xl">What's New</h2>
                    </div>
                </div>

                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-sm font-medium">
                            v{version}
                        </span>
                        <span className="text-app-muted text-sm">{latestChanges?.date}</span>
                    </div>

                    <ul className="space-y-2" data-testid="changelog-list">
                        {latestChanges?.changes.map((change, index) => (
                            <li key={index} className="flex items-start gap-2 text-app-primary text-sm">
                                <span className="text-amber-500 mt-1">•</span>
                                <span>{change}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={onDismiss}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        data-testid="whats-new-dismiss"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
    );
}
