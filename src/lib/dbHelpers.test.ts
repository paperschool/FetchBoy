import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb } = vi.hoisted(() => ({ mockDb: { execute: vi.fn() } }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@/lib/db', () => ({ getDb: () => Promise.resolve(mockDb) }));

import { insertMany } from './dbHelpers';

const FOLDER_FIELDS = ['id', 'collection_id', 'parent_id', 'name', 'sort_order', 'created_at', 'updated_at'];

describe('insertMany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.execute.mockResolvedValue({});
  });

  it('does nothing for zero rows', async () => {
    await insertMany('folders', FOLDER_FIELDS, []);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it('inserts in a single statement when rows fit under the limit', async () => {
    await insertMany('x', ['a', 'b'], [['1', '2'], ['3', '4']]);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
    expect((mockDb.execute.mock.calls[0][1] as unknown[]).length).toBe(4);
  });

  it('chunks large inserts so no statement exceeds the SQLite bound-parameter ceiling', async () => {
    // 7 columns → chunk size floor(900/7) = 128 rows/statement.
    const rows = Array.from({ length: 300 }, (_, i) => [String(i), 'c', null, 'f', i, 'ts', 'ts']);
    await insertMany('folders', FOLDER_FIELDS, rows);

    // 300 rows / 128 → 3 statements (128 + 128 + 44).
    expect(mockDb.execute).toHaveBeenCalledTimes(3);
    let total = 0;
    for (const call of mockDb.execute.mock.calls) {
      const params = call[1] as unknown[];
      expect(params.length).toBeLessThanOrEqual(900);
      total += params.length;
    }
    // All 300 rows persisted (300 * 7 params).
    expect(total).toBe(300 * FOLDER_FIELDS.length);
  });
});
