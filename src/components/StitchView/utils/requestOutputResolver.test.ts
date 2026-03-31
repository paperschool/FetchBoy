import { describe, it, expect } from 'vitest';
import { getRequestOutputPorts } from './requestOutputResolver';

describe('getRequestOutputPorts', () => {
  it('returns status, headers, body', () => {
    expect(getRequestOutputPorts()).toEqual(['status', 'headers', 'body']);
  });

  it('returns a new array each call', () => {
    const a = getRequestOutputPorts();
    const b = getRequestOutputPorts();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
