export type MatchType = 'exact' | 'partial' | 'wildcard' | 'regex';

export const MATCH_TYPES: MatchType[] = ['exact', 'partial', 'wildcard', 'regex'];

export const PLACEHOLDERS: Record<MatchType, string> = {
  exact: 'https://api.example.com/users/123',
  partial: 'api/users',
  wildcard: '*/api/users/*',
  regex: '^/api/users/\\d+$',
};

export const MATCH_DESCRIPTIONS: Record<MatchType, string> = {
  exact: 'The full URL must match the pattern character-for-character, including protocol and query string.',
  partial: 'The pattern can appear anywhere in the URL as a substring.',
  wildcard: 'Use * as a wildcard to match any characters. e.g. *api.example.com/v2/* matches any path under /v2/.',
  regex: 'A regular expression evaluated against the full URL. e.g. /users/\\d+ matches numeric user IDs.',
};

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
