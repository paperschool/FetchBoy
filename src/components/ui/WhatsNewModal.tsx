import { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, ArrowUpCircle } from 'lucide-react';
import { fetchLatestRelease, compareSemver, type LatestReleaseInfo } from '@/lib/appVersion';
import { t } from '@/lib/i18n';

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
    const [openVersion, setOpenVersion] = useState<string | null>(changelog[0]?.version ?? null);
    const [latestRelease, setLatestRelease] = useState<LatestReleaseInfo | null>(null);
    const hasUpdate = latestRelease && compareSemver(latestRelease.version, version) > 0;

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDismiss();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onDismiss]);

    useEffect(() => {
        void fetchLatestRelease().then((release) => {
            if (release) setLatestRelease(release);
        });
    }, []);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            data-testid="whats-new-overlay"
            onClick={onDismiss}
        >
            <div
                className="bg-app-main border border-app-subtle rounded-lg p-6 w-[520px] h-[480px] shadow-xl flex flex-col"
                data-testid="whats-new-modal"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 mb-4 shrink-0">
                    <Sparkles className="text-amber-500" size={24} />
                    <h2 className="text-app-primary font-semibold text-xl">{t('common.whatsNew')}</h2>
                    <span className="ml-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded text-sm font-medium">
                        v{version}
                    </span>
                </div>

                {hasUpdate && latestRelease && (
                    <a
                        href={latestRelease.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 flex items-center gap-2 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-400 hover:bg-green-600/20 transition-colors shrink-0"
                    >
                        <ArrowUpCircle size={16} className="shrink-0" />
                        <span>Update available: <strong>v{latestRelease.version}</strong> — click to download</span>
                    </a>
                )}

                <div className="overflow-y-auto flex-1 space-y-1 pr-1" data-testid="changelog-list">
                    {changelog.map((entry) => {
                        const isOpen = openVersion === entry.version;
                        return (
                            <div key={entry.version} className="border border-app-subtle rounded-md overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setOpenVersion(isOpen ? null : entry.version)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-app-subtle transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-app-primary">v{entry.version}</span>
                                        <span className="text-xs text-app-muted">{entry.date}</span>
                                    </div>
                                    <ChevronDown
                                        size={14}
                                        className={`text-app-muted transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isOpen && (
                                    <ul className="px-3 pb-3 pt-1 space-y-1.5 border-t border-app-subtle">
                                        {entry.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-2 text-app-primary text-sm">
                                                <span className="text-amber-500 mt-0.5 shrink-0">•</span>
                                                <span>{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-end mt-4 shrink-0">
                    <button
                        onClick={onDismiss}
                        className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        data-testid="whats-new-dismiss"
                    >
                        {t('common.gotIt')}
                    </button>
                </div>
            </div>
        </div>
    );
}
