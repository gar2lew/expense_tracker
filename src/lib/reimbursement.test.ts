import { describe, it, expect, beforeEach } from 'vitest';
import { openDB } from 'idb';
import { addExpense, getAllExpenses, updateExpense, clearExpenses, bulkAddExpenses, Expense } from './db';

const DB_NAME = 'expense-tracker-db';

describe('IndexedDB implementation', () => {
  beforeEach(async () => {
    await clearExpenses();
  });

  it('database version remains 1', async () => {
    const db = await openDB(DB_NAME, 1);
    expect(db.version).toBe(1);
    db.close();
  });

  it('no by-reimbursed index exists', async () => {
    const db = await openDB(DB_NAME, 1);
    const store = db.transaction('expenses').objectStore('expenses');
    expect(store.indexNames.contains('by-reimbursed')).toBe(false);
    db.close();
  });

  it('no separate transaction inside upgrade callback (db opens without error)', async () => {
    const db = await openDB(DB_NAME, 1);
    expect(db.objectStoreNames.contains('expenses')).toBe(true);
    db.close();
  });
});

describe('In-memory reimbursement normalization', () => {
  beforeEach(async () => {
    await clearExpenses();
  });

  async function insertRaw(record: Record<string, unknown>): Promise<void> {
    const db = await openDB(DB_NAME, 1);
    const tx = db.transaction('expenses', 'readwrite');
    const store = tx.objectStore('expenses');
    await store.put(record);
    await tx.done;
    db.close();
  }

  it('legacy records without reimbursed field are treated as unpaid', async () => {
    await insertRaw({
      id: 'legacy-1',
      date: '2026-01-01',
      vendor: 'Old Corp',
      totalAmount: 50,
      currency: 'AUD',
      category: 'Other',
      description: '',
      createdAt: 1000,
    });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(false);
    expect(expenses[0].reimbursedAt).toBeUndefined();
  });

  it('legacy records with reimbursed: undefined treated as unpaid', async () => {
    await insertRaw({
      id: 'legacy-2',
      date: '2026-01-02',
      vendor: 'Old Corp',
      totalAmount: 30,
      currency: 'AUD',
      category: 'Travel',
      description: '',
      createdAt: 2000,
      reimbursed: undefined,
    });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(false);
  });

  it('records with reimbursed: true remain paid', async () => {
    await insertRaw({
      id: 'paid-1',
      date: '2026-01-03',
      vendor: 'PaidCo',
      totalAmount: 100,
      currency: 'AUD',
      category: 'Supplies',
      description: '',
      createdAt: 3000,
      reimbursed: true,
      reimbursedAt: 1712345678000,
    });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(true);
    expect(expenses[0].reimbursedAt).toBe(1712345678000);
  });

  it('records with reimbursed: false remain unpaid', async () => {
    await insertRaw({
      id: 'unpaid-1',
      date: '2026-01-04',
      vendor: 'UnpaidCo',
      totalAmount: 75,
      currency: 'AUD',
      category: 'Food & Dining',
      description: '',
      createdAt: 4000,
      reimbursed: false,
    });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(false);
  });

  it('unpaid records clear reimbursedAt in the normalised result', async () => {
    await insertRaw({
      id: 'stale-1',
      date: '2026-01-05',
      vendor: 'StaleCo',
      totalAmount: 60,
      currency: 'AUD',
      category: 'Other',
      description: '',
      createdAt: 5000,
      reimbursed: false,
      reimbursedAt: 1700000000000,
    });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(false);
    expect(expenses[0].reimbursedAt).toBeUndefined();
  });

  it('new expense defaults to unpaid via addExpense', async () => {
    await addExpense({ date: '2026-02-01', vendor: 'NewCo', totalAmount: 25, currency: 'AUD', category: 'Other', description: '', createdAt: 1, reimbursed: false });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].reimbursed).toBe(false);
  });

  it('bulk imported legacy expenses default to unpaid', async () => {
    await clearExpenses();
    const legacyRecord: Expense = {
      id: 'legacy-bulk-1',
      date: '2026-03-01',
      vendor: 'BulkCo',
      totalAmount: 150,
      currency: 'AUD',
      category: 'Supplies',
      description: '',
      createdAt: 1,
      reimbursed: false,
    };
    const record = legacyRecord as unknown as Record<string, unknown>;
    delete record.reimbursed;
    await bulkAddExpenses([legacyRecord]);
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].id).toBe('legacy-bulk-1');
  });

  it('existing receipt data is preserved through normalization', async () => {
    await addExpense({ date: '2026-04-01', vendor: 'ReceiptCo', totalAmount: 44, currency: 'AUD', category: 'Travel', description: '', createdAt: 1, reimbursed: true, reimbursedAt: Date.now(), imageUrlBase64: 'data:image/png;base64,ABC123==' });
    const expenses = await getAllExpenses();
    expect(expenses).toHaveLength(1);
    expect(expenses[0].imageUrlBase64).toBe('data:image/png;base64,ABC123==');
    expect(expenses[0].vendor).toBe('ReceiptCo');
    expect(expenses[0].totalAmount).toBe(44);
  });

  it('legacy records without reimbursed default to unpaid in normalization', async () => {
    const raw = { id: 'raw-1', vendor: 'Raw', totalAmount: 10, currency: 'AUD', category: 'Other', description: '', date: '2026-05-01', createdAt: 1 };
    const normalised = { ...raw, reimbursed: (raw as unknown as { reimbursed?: boolean }).reimbursed === true, reimbursedAt: (raw as unknown as { reimbursed?: boolean }).reimbursed === true ? (raw as unknown as { reimbursedAt?: number }).reimbursedAt : undefined };
    expect(normalised.reimbursed).toBe(false);
    expect(normalised.reimbursedAt).toBeUndefined();
  });
});

describe('Paid/Unpaid filtering', () => {
  beforeEach(async () => {
    await clearExpenses();
  });

  it('paid/unpaid filtering still works in application memory', async () => {
    await addExpense({ date: '2026-06-01', vendor: 'A', totalAmount: 10, currency: 'AUD', category: 'Other', description: '', createdAt: 1, reimbursed: false });
    await addExpense({ date: '2026-06-02', vendor: 'B', totalAmount: 20, currency: 'AUD', category: 'Other', description: '', createdAt: 2, reimbursed: false });
    await addExpense({ date: '2026-06-03', vendor: 'C', totalAmount: 30, currency: 'AUD', category: 'Other', description: '', createdAt: 3, reimbursed: true });
    await addExpense({ date: '2026-06-04', vendor: 'D', totalAmount: 40, currency: 'AUD', category: 'Other', description: '', createdAt: 4, reimbursed: true });

    const all = await getAllExpenses();
    const unpaid = all.filter((e) => !e.reimbursed);
    const paid = all.filter((e) => e.reimbursed);

    expect(unpaid.length).toBe(2);
    expect(paid.length).toBe(2);
  });
});

describe('Toggle persistence', () => {
  beforeEach(async () => {
    await clearExpenses();
  });

  it('toggle from unpaid to paid persists and survives reload', async () => {
    await addExpense({ date: '2026-07-01', vendor: 'Test', totalAmount: 80, currency: 'AUD', category: 'Travel', description: '', createdAt: 1, reimbursed: false });

    const [before] = await getAllExpenses();
    expect(before.reimbursed).toBe(false);

    const now = Date.now();
    await updateExpense({ ...before, reimbursed: true, reimbursedAt: now });

    const [after] = await getAllExpenses();
    expect(after.reimbursed).toBe(true);
    expect(after.reimbursedAt).toBe(now);
  });

  it('toggle from paid back to unpaid persists', async () => {
    await addExpense({ date: '2026-07-02', vendor: 'Test2', totalAmount: 90, currency: 'AUD', category: 'Supplies', description: '', createdAt: 2, reimbursed: true, reimbursedAt: Date.now() });

    const [before] = await getAllExpenses();
    expect(before.reimbursed).toBe(true);

    await updateExpense({ ...before, reimbursed: false, reimbursedAt: undefined });

    const [after] = await getAllExpenses();
    expect(after.reimbursed).toBe(false);
    expect(after.reimbursedAt).toBeUndefined();
  });
});
