import { describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from '@/lib/utils';

describe('formatRelativeTime', () => {
    it('returns "just now" for dates less than 1 minute ago', () => {
        const now = new Date().toISOString();
        expect(formatRelativeTime(now)).toBe('just now');
    });

    it('returns minutes ago for dates within the last hour', () => {
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
        expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
    });

    it('returns hours ago for dates within the last day', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
        expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
    });

    it('returns days ago for dates older than 24 hours', () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString();
        expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('returns "just now" for dates 59 seconds ago', () => {
        const fiftyNineSecAgo = new Date(Date.now() - 59_000).toISOString();
        expect(formatRelativeTime(fiftyNineSecAgo)).toBe('just now');
    });

    it('returns "1m ago" for dates exactly 1 minute ago', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-06-01T12:00:00Z'));
        const oneMinAgo = new Date('2024-06-01T11:59:00Z').toISOString();
        expect(formatRelativeTime(oneMinAgo)).toBe('1m ago');
        vi.useRealTimers();
    });
});
