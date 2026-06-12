import { getAllExpenses, bulkAddExpenses, Expense } from './db';

/**
 * Downloads all stored expenses in the IndexedDB as a readable formatted JSON file backup.
 */
export async function exportExpensesToJSON(): Promise<void> {
  try {
    const list = await getAllExpenses();
    const jsonString = JSON.stringify(list, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const today = new Date().toISOString().split('T')[0];
    const link = document.createElement('a');
    link.href = url;
    link.download = `expenses-backup-${today}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    console.error('Failed to export expenses:', error instanceof Error ? error.message : error);
    throw new Error('Failed to package backup payload.');
  }
}

/**
 * Reads a uploaded JSON file, parses the structural payload, validates fields, and records it back into IndexedDB.
 */
export async function importExpensesFromJSON(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          reject(new Error('Uploaded file is empty.'));
          return;
        }

        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          reject(new Error('Invalid structural format. Expected an array of expense entries.'));
          return;
        }

        // Structural validation
        const validatedArray: Expense[] = [];
        for (const item of data) {
          if (
            typeof item === 'object' &&
            item !== null &&
            'date' in item &&
            'vendor' in item &&
            'totalAmount' in item
          ) {
            validatedArray.push({
              id: item.id || Math.random().toString(36).substring(2, 15),
              date: String(item.date),
              vendor: String(item.vendor),
              totalAmount: Number(item.totalAmount) || 0,
              currency: String(item.currency || 'AUD').toUpperCase(),
              category: String(item.category || 'Other'),
              description: String(item.description || ''),
              imageUrlBase64: item.imageUrlBase64 !== undefined ? String(item.imageUrlBase64) : undefined,
              createdAt: Number(item.createdAt) || Date.now()
            });
          }
        }

        if (validatedArray.length === 0) {
          reject(new Error('No valid compatible expense objects found in the payload file.'));
          return;
        }

        await bulkAddExpenses(validatedArray);
        resolve(validatedArray.length);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        reject(new Error(`Validation failed: ${message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read backup file.'));
    reader.readAsText(file);
  });
}
