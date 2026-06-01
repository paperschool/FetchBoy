import { describe, expect, it } from 'vitest';
import packageJson from '../../package.json';
import { getCurrentVersion, isNewVersion } from './appVersion';

describe('getCurrentVersion', () => {
    it('returns a non-empty version string', () => {
        expect(getCurrentVersion()).toBeTruthy();
        expect(typeof getCurrentVersion()).toBe('string');
    });

    it('returns the package.json version', () => {
        expect(getCurrentVersion()).toBe(packageJson.version);
    });
});

describe('isNewVersion', () => {
    it('returns true for null (first launch)', () => {
        expect(isNewVersion(null)).toBe(true);
    });

    it('returns false for same version', () => {
        expect(isNewVersion(getCurrentVersion())).toBe(false);
    });

    it('returns true for a different (older) version', () => {
        expect(isNewVersion('0.0.0')).toBe(true);
    });

    it('returns true for empty string', () => {
        expect(isNewVersion('')).toBe(true);
    });
});
