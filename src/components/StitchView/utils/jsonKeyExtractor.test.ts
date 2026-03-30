import { describe, it, expect } from 'vitest';
import { extractJsonKeys } from './jsonKeyExtractor';

describe('extractJsonKeys', () => {
  it('extracts top-level keys from a valid object', () => {
    const result = extractJsonKeys('{"name": "John", "age": 30}');
    expect(result.keys).toEqual(['name', 'age']);
    expect(result.error).toBeNull();
  });

  it('returns only top-level keys for nested objects', () => {
    const result = extractJsonKeys('{"user": {"name": "John"}, "count": 1}');
    expect(result.keys).toEqual(['user', 'count']);
    expect(result.error).toBeNull();
  });

  it('returns empty keys for an array', () => {
    const result = extractJsonKeys('[1, 2, 3]');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Must be a JSON object');
  });

  it('returns empty keys for a primitive string', () => {
    const result = extractJsonKeys('"hello"');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Must be a JSON object');
  });

  it('returns empty keys for a number', () => {
    const result = extractJsonKeys('42');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Must be a JSON object');
  });

  it('returns empty keys for null', () => {
    const result = extractJsonKeys('null');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Must be a JSON object');
  });

  it('returns error for invalid JSON', () => {
    const result = extractJsonKeys('{bad json}');
    expect(result.keys).toEqual([]);
    expect(result.error).toBeTruthy();
  });

  it('returns empty keys and error for empty string', () => {
    const result = extractJsonKeys('');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Empty input');
  });

  it('returns empty keys for an empty object', () => {
    const result = extractJsonKeys('{}');
    expect(result.keys).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('handles whitespace-only input', () => {
    const result = extractJsonKeys('   ');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Empty input');
  });
});
