import packageJson from '../../package.json';

export function getCurrentVersion(): string {
    return packageJson.version;
}

export function isNewVersion(lastSeen: string | null): boolean {
    if (!lastSeen) return true;
    return lastSeen !== getCurrentVersion();
}
