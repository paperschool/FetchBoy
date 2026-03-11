import { describe, expect, it } from 'vitest';
import { getCurrentVersion, isNewVersion } from './appVersion';

describe('getCurrentVersion', () => {
    it('returns a non-empty version string', () => {
        expect(getCurrentVersion()).toBeTruthy();
        expect(typeof getCurrentVersion()).toBe('string');
    });

    it('returns package.json version (0.1.0)', () => {
        expect(getCurrentVersion()).toBe('0.1.0');
    });
});

describe('isNewVersion', () => {
    it('returns true for null (first launch)', () => {
        expect(isNewVersion(null)).toBe(true);
    });

    it('returns false for same version', () => {
        expect(isNewVersion('0.1.0')).toBe(false);
    });

    it('returns true for different (older) version', () => {
        expect(isNewVersion('0.0.9')).toBe(true);
    });

    it('returns true for empty string', () => {
        expect(isNewVersion('')).toBe(true);
    });
});
