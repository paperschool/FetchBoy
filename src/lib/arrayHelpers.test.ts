import { describe, it, expect } from 'vitest';
import { addWithMaxSize } from './arrayHelpers';

describe('addWithMaxSize', () => {
  it('appends item to array', () => {
    const arr = [1, 2];
    addWithMaxSize(arr, 3, 10);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('trims from front when exceeding max (append mode)', () => {
    const arr = [1, 2, 3];
    addWithMaxSize(arr, 4, 3);
    expect(arr).toEqual([2, 3, 4]);
  });

  it('prepends item when prepend=true', () => {
    const arr = [2, 3];
    addWithMaxSize(arr, 1, 10, true);
    expect(arr).toEqual([1, 2, 3]);
  });

  it('trims from back when exceeding max (prepend mode)', () => {
    const arr = [1, 2, 3];
    addWithMaxSize(arr, 0, 3, true);
    expect(arr).toEqual([0, 1, 2]);
  });

  it('handles single-element max size', () => {
    const arr: number[] = [];
    addWithMaxSize(arr, 1, 1);
    addWithMaxSize(arr, 2, 1);
    expect(arr).toEqual([2]);
  });
});
