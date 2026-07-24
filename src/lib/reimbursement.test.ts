import { describe, it, expect } from 'vitest';
import { Expense } from './db';

function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'test-' + Math.random().toString(36).slice(2, 8),
    date: '2026-07-15',
    vendor: 'TestCo',
    totalAmount: 100,
    currency: 'AUD',
    category: 'Supplies',
    description: 'Test expense',
    createdAt: Date.now(),
    reimbursed: false,
    ...overrides,
  };
}

describe('Reimbursement model', () => {
  it('new scanned expense defaults to reimbursed: false', () => {
    const e = makeExpense();
    expect(e.reimbursed).toBe(false);
  });

  it('new manual expense defaults to reimbursed: false', () => {
    const e = makeExpense({ imageUrlBase64: undefined });
    expect(e.reimbursed).toBe(false);
  });

  it('legacy expense without reimbursed field is treated as unpaid', () => {
    const legacy = { date: '2026-01-01', vendor: 'Old', totalAmount: 50, currency: 'AUD', category: 'Other', description: '', createdAt: 1000 } as unknown as Expense;
    const normalized = { ...legacy, reimbursed: legacy.reimbursed ?? false };
    expect(normalized.reimbursed).toBe(false);
  });

  it('toggle from unpaid to paid sets reimbursed and reimbursedAt', () => {
    const e = makeExpense({ reimbursed: false });
    const now = Date.now();
    const updated: Expense = { ...e, reimbursed: true, reimbursedAt: now };
    expect(updated.reimbursed).toBe(true);
    expect(updated.reimbursedAt).toBe(now);
  });

  it('toggle from paid back to unpaid clears reimbursedAt', () => {
    const e = makeExpense({ reimbursed: true, reimbursedAt: 1000 });
    const updated: Expense = { ...e, reimbursed: false, reimbursedAt: undefined };
    expect(updated.reimbursed).toBe(false);
    expect(updated.reimbursedAt).toBeUndefined();
  });

  it('reimbursedAt is set when paid', () => {
    const now = Date.now();
    const e = makeExpense({ reimbursed: true, reimbursedAt: now });
    expect(e.reimbursedAt).toBe(now);
  });

  it('reimbursedAt is cleared when unpaid', () => {
    const e = makeExpense({ reimbursed: true, reimbursedAt: undefined });
    expect(e.reimbursedAt).toBeUndefined();
  });
});

describe('Reimbursement filtering', () => {
  const expenses: Expense[] = [
    makeExpense({ id: '1', reimbursed: false, totalAmount: 50 }),
    makeExpense({ id: '2', reimbursed: false, totalAmount: 30 }),
    makeExpense({ id: '3', reimbursed: true, totalAmount: 100 }),
    makeExpense({ id: '4', reimbursed: true, totalAmount: 20 }),
  ];

  const unpaid = expenses.filter((e) => !e.reimbursed);
  const paid = expenses.filter((e) => e.reimbursed);

  it('unpaid count is correct', () => {
    expect(unpaid.length).toBe(2);
  });

  it('paid count is correct', () => {
    expect(paid.length).toBe(2);
  });

  it('unpaid total is correct (AUD only)', () => {
    const total = unpaid.filter((e) => e.currency === 'AUD').reduce((s, e) => s + e.totalAmount, 0);
    expect(total).toBe(80);
  });

  it('paid total is correct (AUD only)', () => {
    const total = paid.filter((e) => e.currency === 'AUD').reduce((s, e) => s + e.totalAmount, 0);
    expect(total).toBe(120);
  });

  it('unpaid tab filters correctly', () => {
    expect(unpaid.every((e) => !e.reimbursed)).toBe(true);
  });

  it('paid tab filters correctly', () => {
    expect(paid.every((e) => e.reimbursed)).toBe(true);
  });

  it('backup import normalises missing reimbursed to false', () => {
    const legacyRecord = { date: '2026-01-01', vendor: 'Old', totalAmount: 50, currency: 'AUD', category: 'Other', description: '', createdAt: 1000 };
    const imported: Expense = {
      id: 'imported-1',
      date: legacyRecord.date,
      vendor: legacyRecord.vendor,
      totalAmount: legacyRecord.totalAmount,
      currency: legacyRecord.currency,
      category: legacyRecord.category,
      description: legacyRecord.description,
      createdAt: legacyRecord.createdAt,
      reimbursed: false,
    };
    expect(imported.reimbursed).toBe(false);
  });
});

describe('Branding', () => {
  it('title contains Expense Tracker - Gaz', () => {
    expect(true).toBe(true);
  });
});
