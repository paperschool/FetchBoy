import { describe, it, expect } from 'vitest';
import { formatNodeOutput } from './formatNodeOutput';

describe('formatNodeOutput', () => {
  it('formats a plain object as pretty JSON', () => {
    const result = formatNodeOutput({ status: 200, body: 'ok' });
    expect(result).toBe(JSON.stringify({ status: 200, body: 'ok' }, null, 2));
  });

  it('formats a request-style output with status, headers, body', () => {
    const output = { status: 200, headers: { 'content-type': 'application/json' }, body: { id: 1 } };
    const result = formatNodeOutput(output);
    expect(JSON.parse(result)).toEqual(output);
  });

  it('formats a sleep-style output with _delayMs', () => {
    const output = { _delayMs: 1000, foo: 'bar' };
    const result = formatNodeOutput(output);
    expect(JSON.parse(result)).toEqual(output);
  });

  it('returns empty string for null', () => {
    expect(formatNodeOutput(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatNodeOutput(undefined)).toBe('');
  });

  it('handles arrays', () => {
    const output = [1, 2, 3];
    const result = formatNodeOutput(output);
    expect(JSON.parse(result)).toEqual([1, 2, 3]);
  });

  it('handles primitive values', () => {
    expect(formatNodeOutput(42)).toBe('42');
    expect(formatNodeOutput('hello')).toBe('"hello"');
  });
});
