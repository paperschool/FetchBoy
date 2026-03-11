import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAllSettings, saveSetting } from './settings';

// ─── Hoisted mock state ───────────────────────────────────────────────────────

const { mockDb } = vi.hoisted(() => {
    const mockDb = {
        select: vi.fn(),
        execute: vi.fn(),
    };
    return { mockDb };
});

vi.mock('@/lib/db', () => ({
    getDb: () => Promise.resolve(mockDb),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('loadAllSettings', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses all 4 JSON-serialised values correctly', async () => {
        mockDb.select.mockResolvedValue([
            { key: 'theme', value: '"dark"' },
            { key: 'request_timeout_ms', value: '5000' },
            { key: 'ssl_verify', value: 'false' },
            { key: 'editor_font_size', value: '16' },
        ]);

        const result = await loadAllSettings();

        expect(result).toEqual({
            theme: 'dark',
            request_timeout_ms: 5000,
            ssl_verify: false,
            editor_font_size: 16,
            sidebar_collapsed: false,
            sidebar_settings_expanded: false,
            has_seeded_sample_data: false,
        });
    });

    it('returns defaults when DB throws', async () => {
        mockDb.select.mockRejectedValue(new Error('DB unavailable'));

        const result = await loadAllSettings();

        expect(result).toEqual({
            theme: 'system',
            request_timeout_ms: 30000,
            ssl_verify: true,
            editor_font_size: 14,
            sidebar_collapsed: false,
            sidebar_settings_expanded: false,
            has_seeded_sample_data: false,
        });
    });

    it('returns defaults for missing keys', async () => {
        mockDb.select.mockResolvedValue([]);

        const result = await loadAllSettings();

        expect(result).toEqual({
            theme: 'system',
            request_timeout_ms: 30000,
            ssl_verify: true,
            editor_font_size: 14,
            sidebar_collapsed: false,
            sidebar_settings_expanded: false,
            has_seeded_sample_data: false,
        });
    });
});

describe('saveSetting', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.execute.mockResolvedValue(undefined);
    });

    it('calls execute with correct SQL and JSON.stringify(value) for string', async () => {
        await saveSetting('theme', 'light');

        expect(mockDb.execute).toHaveBeenCalledWith(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['theme', '"light"'],
        );
    });

    it('calls execute with correct SQL and JSON.stringify(value) for number', async () => {
        await saveSetting('request_timeout_ms', 10000);

        expect(mockDb.execute).toHaveBeenCalledWith(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['request_timeout_ms', '10000'],
        );
    });

    it('calls execute with correct SQL and JSON.stringify(value) for boolean', async () => {
        await saveSetting('ssl_verify', false);

        expect(mockDb.execute).toHaveBeenCalledWith(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['ssl_verify', 'false'],
        );
    });
});
