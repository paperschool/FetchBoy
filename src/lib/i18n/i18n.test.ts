import { describe, it, expect } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('returns the English string for a known key', () => {
    expect(t('common.save')).toBe('Save');
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('common.delete')).toBe('Delete');
  });

  it('interpolates params into placeholders', () => {
    expect(t('common.importedCount', { count: 5 })).toBe('Imported 5 items');
  });

  it('returns the key string for an unknown key (dev fallback)', () => {
    // @ts-expect-error testing missing key
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('keeps unreplaced placeholders when params are partial', () => {
    expect(t('common.importedCount', {})).toBe('Imported {count} items');
  });

  it('returns template without replacement when no params given', () => {
    expect(t('common.loading')).toBe('Loading...');
  });

  it('handles numeric param values', () => {
    expect(t('common.importedCount', { count: 0 })).toBe('Imported 0 items');
  });
});
