import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = {
    execute: vi.fn(),
    select: vi.fn(),
};

vi.mock('@/lib/db', () => ({
    getDb: vi.fn().mockResolvedValue(mockDb),
}));

describe('environments lib', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.execute.mockResolvedValue({});
        mockDb.select.mockResolvedValue([]);
    });

    describe('loadAllEnvironments', () => {
        it('deserializes variables from JSON and maps is_active from 0/1 to boolean', async () => {
            mockDb.select.mockResolvedValueOnce([
                {
                    id: 'env-1',
                    name: 'Development',
                    variables: '[{"key":"BASE_URL","value":"http://localhost","enabled":true}]',
                    is_active: 1,
                    created_at: '2026-01-01T00:00:00Z',
                },
                {
                    id: 'env-2',
                    name: 'Production',
                    variables: '[]',
                    is_active: 0,
                    created_at: '2026-01-02T00:00:00Z',
                },
            ]);
            const { loadAllEnvironments } = await import('./environments');
            const result = await loadAllEnvironments();
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('env-1');
            expect(result[0].variables).toEqual([
                { key: 'BASE_URL', value: 'http://localhost', enabled: true },
            ]);
            expect(result[0].is_active).toBe(true);
            expect(result[1].is_active).toBe(false);
            expect(result[1].variables).toEqual([]);
        });

        it('queries environments ordered by created_at ASC', async () => {
            const { loadAllEnvironments } = await import('./environments');
            await loadAllEnvironments();
            expect(mockDb.select).toHaveBeenCalledWith(
                expect.stringContaining('ORDER BY created_at ASC'),
            );
        });
    });

    describe('createEnvironment', () => {
        it('inserts a new environment and returns it with empty variables and is_active false', async () => {
            const { createEnvironment } = await import('./environments');
            const result = await createEnvironment('Staging');
            expect(result.name).toBe('Staging');
            expect(result.variables).toEqual([]);
            expect(result.is_active).toBe(false);
            expect(typeof result.id).toBe('string');
            expect(mockDb.execute).toHaveBeenCalledOnce();
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO environments'),
                expect.any(Array),
            );
        });
    });

    describe('renameEnvironment', () => {
        it('calls UPDATE SQL with new name and id', async () => {
            const { renameEnvironment } = await import('./environments');
            await renameEnvironment('env-1', 'New Name');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE environments'),
                expect.arrayContaining(['New Name', 'env-1']),
            );
        });
    });

    describe('deleteEnvironment', () => {
        it('calls DELETE SQL with id', async () => {
            const { deleteEnvironment } = await import('./environments');
            await deleteEnvironment('env-1');
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('DELETE FROM environments'),
                expect.arrayContaining(['env-1']),
            );
        });
    });

    describe('updateEnvironmentVariables', () => {
        it('calls UPDATE SQL with JSON-stringified variables', async () => {
            const { updateEnvironmentVariables } = await import('./environments');
            const vars = [{ key: 'TOKEN', value: 'abc', enabled: true }];
            await updateEnvironmentVariables('env-1', vars);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE environments'),
                expect.arrayContaining([JSON.stringify(vars), 'env-1']),
            );
        });
    });

    describe('setActiveEnvironment', () => {
        it('makes two DB calls when id is provided: clear all then set one', async () => {
            const { setActiveEnvironment } = await import('./environments');
            await setActiveEnvironment('env-1');
            expect(mockDb.execute).toHaveBeenCalledTimes(2);
            // First call: clear all
            expect(mockDb.execute).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('is_active = 0'),
            );
            // Second call: set one
            expect(mockDb.execute).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('is_active = 1'),
                expect.arrayContaining(['env-1']),
            );
        });

        it('makes only one DB call when id is null (clear all only)', async () => {
            const { setActiveEnvironment } = await import('./environments');
            await setActiveEnvironment(null);
            expect(mockDb.execute).toHaveBeenCalledTimes(1);
            expect(mockDb.execute).toHaveBeenCalledWith(
                expect.stringContaining('is_active = 0'),
            );
        });
    });
});
