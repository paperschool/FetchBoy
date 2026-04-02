import { describe, it, expect } from 'vitest';
import { validateUrlPattern, MATCH_TYPES, PLACEHOLDERS, MATCH_DESCRIPTIONS } from './urlPatternConfig';

describe('validateUrlPattern', () => {
  it('returns error for empty pattern', () => {
    expect(validateUrlPattern('', 'exact')).toBe('URL pattern is required');
    expect(validateUrlPattern('  ', 'partial')).toBe('URL pattern is required');
  });

  it('returns null for valid pattern', () => {
    expect(validateUrlPattern('api/users', 'partial')).toBeNull();
    expect(validateUrlPattern('https://example.com', 'exact')).toBeNull();
  });

  it('validates regex pattern', () => {
    expect(validateUrlPattern('^/api/\\d+$', 'regex')).toBeNull();
  });

  it('returns error for invalid regex', () => {
    expect(validateUrlPattern('[invalid', 'regex')).toBe('Invalid regex pattern');
  });
});

describe('constants', () => {
  it('MATCH_TYPES has 4 types', () => {
    expect(MATCH_TYPES).toEqual(['exact', 'partial', 'wildcard', 'regex']);
  });

  it('PLACEHOLDERS has entries for all types', () => {
    for (const type of MATCH_TYPES) {
      expect(PLACEHOLDERS[type]).toBeDefined();
    }
  });

  it('MATCH_DESCRIPTIONS has entries for all types', () => {
    for (const type of MATCH_TYPES) {
      expect(MATCH_DESCRIPTIONS[type]).toBeDefined();
    }
  });
});
