import type { MatchType } from '@/stores/mappingsStore';

export function validateUrlPattern(pattern: string, matchType: MatchType): string | null {
    if (!pattern.trim()) return 'URL pattern is required';
    if (matchType === 'regex') {
        try {
            new RegExp(pattern);
        } catch {
            return 'Invalid regex pattern';
        }
    }
    return null;
}

export const MATCH_TYPES: MatchType[] = ['exact', 'partial', 'wildcard', 'regex'];

export const PLACEHOLDERS: Record<MatchType, string> = {
    exact: 'https://api.example.com/users/123',
    partial: 'api/users',
    wildcard: '*/api/users/*',
    regex: '^/api/users/\\d+$',
};
