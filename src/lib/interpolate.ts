import type { KeyValuePair } from '@/lib/db';

/**
 * Replaces all `{{key}}` tokens in `template` with values from `variables`.
 * Only enabled variables are considered. Unresolved tokens are left verbatim.
 */
export function interpolate(template: string, variables: KeyValuePair[]): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
        const found = variables.find((v) => v.key === key && v.enabled);
        return found ? found.value : _match;
    });
}

/**
 * Returns a deduplicated, alphabetically-sorted list of `{{key}}` token names
 * found in `template` that have no matching enabled variable in `variables`.
 */
export function unresolvedTokens(template: string, variables: KeyValuePair[]): string[] {
    const unresolved = new Set<string>();
    const regex = /\{\{([^}]+)\}\}/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
        const key = match[1];
        const resolved = variables.some((v) => v.key === key && v.enabled && v.value !== '');
        if (!resolved) {
            unresolved.add(key);
        }
    }

    return Array.from(unresolved).sort();
}
