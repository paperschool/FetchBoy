import packageJson from '../../package.json';

const GITHUB_REPO = 'paperschool/FetchBoy';

export function getCurrentVersion(): string {
    return packageJson.version;
}

export function isNewVersion(lastSeen: string | null): boolean {
    if (!lastSeen) return true;
    return lastSeen !== getCurrentVersion();
}

/** Compare two semver strings. Returns 1 if a > b, -1 if a < b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff > 0 ? 1 : -1;
    }
    return 0;
}

export interface LatestReleaseInfo {
    version: string;
    url: string;
}

/** Fetch the latest release version from GitHub. Returns null on failure. */
export async function fetchLatestRelease(): Promise<LatestReleaseInfo | null> {
    try {
        const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github.v3+json' },
        });
        if (!res.ok) return null;
        const data = await res.json() as { tag_name?: string; html_url?: string };
        const tag = data.tag_name?.replace(/^v/, '') ?? '';
        if (!tag) return null;
        return { version: tag, url: data.html_url ?? `https://github.com/${GITHUB_REPO}/releases/latest` };
    } catch {
        return null;
    }
}
