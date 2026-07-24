import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Expense {
  id?: string;
  date: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  category: string;
  description: string;
  imageUrlBase64?: string;
  createdAt: number;
  reimbursed: boolean;
  reimbursedAt?: number;
}

interface ExpenseDB extends DBSchema {
  expenses: {
    key: string;
    value: Expense;
    indexes: {
      'by-date': string;
      'by-reimbursed': string;
    };
  };
}

const DATABASE_NAME = 'expense-tracker-db';
const DATABASE_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ExpenseDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ExpenseDB>(DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db, oldVersion) {
        let store: ReturnType<typeof db.createObjectStore>;
        if (oldVersion < 1) {
          store = db.createObjectStore('expenses', { keyPath: 'id' });
          store.createIndex('by-date', 'date');
        }
        if (oldVersion < 2) {
          const tx = (db as unknown as { transaction: (name: string, mode: string) => IDBObjectStore }).transaction;
          const os = tx.call(db, 'expenses', 'readwrite') as unknown as IDBObjectStore;

          if (!os.indexNames.contains('by-reimbursed')) {
            os.createIndex('by-reimbursed', 'reimbursed');
          }

          const cursorReq = os.openCursor();
          cursorReq.onsuccess = (event: Event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              const record = cursor.value as Expense;
              if (record.reimbursed === undefined) {
                record.reimbursed = false;
                cursor.update(record);
              }
              cursor.continue();
            }
          };
        }
      },
    });
  }
  return dbPromise;
}

export async function addExpense(expense: Omit<Expense, 'id'> & { id?: string }): Promise<string> {
  const db = await getDB();
  const id = expense.id || Math.random().toString(36).substring(2, 15);
  const newExpense: Expense = {
    ...expense,
    id,
    reimbursed: expense.reimbursed ?? false,
  };
  await db.put('expenses', newExpense);
  return id;
}

export async function updateExpense(expense: Expense): Promise<void> {
  const db = await getDB();
  if (!expense.id) throw new Error('Expense ID is required for updates');
  await db.put('expenses', expense);
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('expenses', id);
}

export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDB();
  const list = await db.getAll('expenses');
  return list.sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.createdAt - a.createdAt;
  });
}

export async function clearExpenses(): Promise<void> {
  const db = await getDB();
  await db.clear('expenses');
}

export async function bulkAddExpenses(expenses: Expense[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('expenses', 'readwrite');
  const store = tx.objectStore('expenses');

  for (const exp of expenses) {
    const entry: Expense = {
      ...exp,
      reimbursed: exp.reimbursed ?? false,
    };
    if (entry.id) {
      await store.put(entry);
    } else {
      const id = Math.random().toString(36).substring(2, 15);
      await store.put({ ...entry, id });
    }
  }

  await tx.done;
}
