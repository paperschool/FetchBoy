import { describe, it, expect } from 'vitest';
import { extractReturnKeys } from './jsKeyExtractor';

describe('extractReturnKeys', () => {
  it('extracts keys from object literal return', () => {
    const result = extractReturnKeys('return { foo: 1, bar: 2 }');
    expect(result.keys).toEqual(['foo', 'bar']);
    expect(result.error).toBeNull();
  });

  it('extracts shorthand property keys', () => {
    const result = extractReturnKeys('return { foo, bar }');
    expect(result.keys).toEqual(['foo', 'bar']);
    expect(result.error).toBeNull();
  });

  it('handles mixed shorthand and key-value', () => {
    const result = extractReturnKeys('return { foo, bar: 2, baz }');
    expect(result.keys).toEqual(['foo', 'bar', 'baz']);
    expect(result.error).toBeNull();
  });

  it('returns empty keys for variable return', () => {
    const result = extractReturnKeys('return result');
    expect(result.keys).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns empty keys for no return statement', () => {
    const result = extractReturnKeys('const x = 1;');
    expect(result.keys).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('returns empty keys for empty code', () => {
    const result = extractReturnKeys('');
    expect(result.keys).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('uses the last return statement', () => {
    const code = `
      if (condition) return { a: 1 };
      return { b: 2, c: 3 };
    `;
    const result = extractReturnKeys(code);
    expect(result.keys).toEqual(['b', 'c']);
  });

  it('extracts only top-level keys from nested objects', () => {
    const code = 'return { outer: { inner: 1 }, flat: 2 }';
    const result = extractReturnKeys(code);
    expect(result.keys).toEqual(['outer', 'flat']);
  });

  it('skips spread properties', () => {
    const code = 'return { ...spread, extra: 1 }';
    const result = extractReturnKeys(code);
    expect(result.keys).toEqual(['extra']);
  });

  it('returns error for unbalanced braces', () => {
    const result = extractReturnKeys('return { foo: 1');
    expect(result.keys).toEqual([]);
    expect(result.error).toBe('Unbalanced braces in return statement');
  });

  it('handles return with multiline object', () => {
    const code = `return {
      name: "test",
      value: 42,
      nested: { a: 1 }
    }`;
    const result = extractReturnKeys(code);
    expect(result.keys).toEqual(['name', 'value', 'nested']);
  });

  it('handles quoted keys', () => {
    const code = 'return { "status": 200, \'message\': "ok" }';
    const result = extractReturnKeys(code);
    expect(result.keys).toEqual(['status', 'message']);
  });
});
