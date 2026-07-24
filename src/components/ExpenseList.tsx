import React, { useState, useMemo } from 'react';
import { Expense, updateExpense } from '../lib/db';
import { formatCurrency, formatFriendlyDate } from '../lib/utils';
import { 
  Trash2, Edit3, Calendar, 
  Receipt, X, FileText, Check
} from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  onUpdate: (expense: Expense) => void;
}

type TabView = 'unpaid' | 'paid';

export default function ExpenseList({ expenses, onDelete, onUpdate }: ExpenseListProps) {
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeReceiptImg, setActiveReceiptImg] = useState<string | null>(null);
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabView>('unpaid');

  const unpaidExpenses = useMemo(() => expenses.filter((e) => !e.reimbursed), [expenses]);
  const paidExpenses = useMemo(() => expenses.filter((e) => e.reimbursed), [expenses]);
  const visibleExpenses = activeTab === 'unpaid' ? unpaidExpenses : paidExpenses;

  const unpaidTotalAUD = useMemo(() => unpaidExpenses.reduce((sum, e) => e.currency === 'AUD' ? sum + e.totalAmount : sum, 0), [unpaidExpenses]);
  const paidTotalAUD = useMemo(() => paidExpenses.reduce((sum, e) => e.currency === 'AUD' ? sum + e.totalAmount : sum, 0), [paidExpenses]);

  const groups = useMemo(() => {
    const g: Record<string, Expense[]> = {};
    visibleExpenses.forEach((expense) => {
      try {
        const dateParts = expense.date.split('-');
        const year = dateParts[0];
        const monthNum = parseInt(dateParts[1], 10) - 1;
        const dateObj = new Date(parseInt(year, 10), monthNum, 1);
        const monthName = dateObj.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

        if (!g[monthName]) g[monthName] = [];
        g[monthName].push(expense);
      } catch {
        const fallback = 'Unscheduled';
        if (!g[fallback]) g[fallback] = [];
        g[fallback].push(expense);
      }
    });
    return g;
  }, [visibleExpenses]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Food & Dining': return 'bg-emerald-50/60 text-emerald-700 border-emerald-100/80 ring-1 ring-emerald-600/10';
      case 'Supplies': return 'bg-amber-50/60 text-amber-700 border-amber-100/80 ring-1 ring-amber-600/10';
      case 'Travel': return 'bg-blue-50/60 text-blue-700 border-blue-100/80 ring-1 ring-blue-600/10';
      case 'Utilities': return 'bg-purple-50/60 text-purple-700 border-purple-100/80 ring-1 ring-purple-600/10';
      case 'Retail': return 'bg-sky-50/60 text-sky-700 border-sky-100/80 ring-1 ring-sky-600/10';
      case 'Subscriptions': return 'bg-rose-50/60 text-rose-700 border-rose-100/80 ring-1 ring-rose-600/10';
      case 'Entertainment': return 'bg-pink-50/60 text-pink-700 border-pink-100/80 ring-1 ring-pink-600/10';
      default: return 'bg-slate-50/60 text-slate-700 border-slate-100/80 ring-1 ring-slate-600/10';
    }
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingExpense) {
      onUpdate(editingExpense);
      setEditingExpense(null);
    }
  };

  const calculateGroupTotal = (groupExpenses: Expense[]) => {
    const totals: { [currency: string]: number } = {};
    groupExpenses.forEach((exp) => {
      const curr = exp.currency || 'AUD';
      totals[curr] = (totals[curr] || 0) + exp.totalAmount;
    });
    return Object.entries(totals).map(([curr, sum]) => formatCurrency(sum, curr)).join(' + ');
  };

  const toggleReceiptExpand = (id: string | undefined) => {
    if (!id) return;
    setExpandedReceiptId((prev) => prev === id ? null : id);
  };

  const handleReimbursedToggle = async (expense: Expense) => {
    const now = Date.now();
    const updated: Expense = {
      ...expense,
      reimbursed: !expense.reimbursed,
      reimbursedAt: !expense.reimbursed ? now : undefined,
    };
    try {
      await updateExpense(updated);
      onUpdate(updated);
    } catch {
      // silently fail — parent handles notifications
    }
  };

  if (expenses.length === 0) {
    return (
      <div id="expenses-empty-state" className="text-center py-16 px-6 bg-white rounded-2xl border border-slate-200/60 shadow-premium">
        <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100/50 animate-float">
          <Receipt className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 font-heading">No expenses recorded</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
          Capture receipt details using the AI camera uploader, or create logs manually via the control desk.
        </p>
      </div>
    );
  }

  return (
    <div id="expense-list-container" className="space-y-6">
      {/* Summary Totals */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`bg-white rounded-xl border p-4 shadow-premium cursor-pointer transition-all ${activeTab === 'unpaid' ? 'ring-2 ring-indigo-500 border-indigo-200' : 'border-slate-200/60 hover:border-indigo-200'}`} onClick={() => setActiveTab('unpaid')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('unpaid'); }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unpaid</span>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{unpaidExpenses.length}</span>
          </div>
          <span className="text-xl font-black text-slate-900 font-mono block mt-1">{formatCurrency(unpaidTotalAUD, 'AUD')}</span>
        </div>
        <div className={`bg-white rounded-xl border p-4 shadow-premium cursor-pointer transition-all ${activeTab === 'paid' ? 'ring-2 ring-emerald-500 border-emerald-200' : 'border-slate-200/60 hover:border-emerald-200'}`} onClick={() => setActiveTab('paid')} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('paid'); }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid</span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{paidExpenses.length}</span>
          </div>
          <span className="text-xl font-black text-slate-900 font-mono block mt-1">{formatCurrency(paidTotalAUD, 'AUD')}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-slate-100/80 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setActiveTab('unpaid')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold tracking-tight transition-all ${activeTab === 'unpaid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Unpaid ({unpaidExpenses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('paid')}
          className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold tracking-tight transition-all ${activeTab === 'paid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Paid ({paidExpenses.length})
        </button>
      </div>

      {/* Empty state for active tab */}
      {visibleExpenses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200/60 shadow-premium">
          <p className="text-sm font-bold text-slate-700 mb-1">
            {activeTab === 'unpaid' ? 'All expenses have been reimbursed.' : 'No reimbursed expenses yet.'}
          </p>
          <p className="text-xs text-slate-400">
            {activeTab === 'unpaid' ? 'Switch to the Paid tab to view them.' : 'Toggle an expense to Paid to see it here.'}
          </p>
        </div>
      )}

      {Object.entries(groups).map(([month, monthExpenses]) => (
        <div key={month} className="bg-white rounded-2xl border border-slate-200/60 shadow-premium overflow-hidden print-avoid-break">
          <div className="bg-slate-50/50 border-b border-slate-100 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 font-heading tracking-tight">
              <Calendar className="w-4 h-4 text-slate-400" />
              {month}
            </h3>
            <div className="text-xs font-semibold text-slate-500">
              {calculateGroupTotal(monthExpenses)}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Merchant</th>
                  <th className="px-6 py-3.5">Category</th>
                  <th className="px-6 py-3.5">Description</th>
                  <th className="px-6 py-3.5 text-right">Amount</th>
                  <th className="px-6 py-3.5 text-center">Receipt</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                {monthExpenses.map((expense) => (
                  <React.Fragment key={expense.id}>
                    <tr className="hover:bg-slate-50/80 transition-colors duration-150">
                      <td className="px-6 py-4 whitespace-nowrap text-slate-400 font-mono text-[11px]">{formatFriendlyDate(expense.date)}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{expense.vendor}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-tight ${getCategoryColor(expense.category)}`}>{expense.category}</span>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-slate-450 text-[11px]" title={expense.description}>{expense.description}</td>
                      <td className="px-6 py-4 text-right font-black font-mono text-slate-900 text-sm">{formatCurrency(expense.totalAmount, expense.currency)}</td>
                      <td className="px-6 py-4 text-center">
                        {expense.imageUrlBase64 ? (
                          <button type="button" onClick={() => toggleReceiptExpand(expense.id)} className={`px-2.5 py-1.5 border border-indigo-100 hover:bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-lg transition-all inline-flex items-center gap-1 cursor-pointer active:scale-95 ${expandedReceiptId === expense.id ? 'bg-indigo-50/60 ring-2 ring-indigo-500/10' : 'bg-white shadow-2xs'}`}>
                            <Receipt className="w-3.5 h-3.5" />
                            {expandedReceiptId === expense.id ? 'Hide' : 'View'}
                          </button>
                        ) : <span className="text-xs text-slate-300">-</span>}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px] min-w-[44px] justify-center" aria-label={`Mark ${expense.vendor} as ${expense.reimbursed ? 'Unpaid' : 'Paid'}`}>
                          <input type="checkbox" checked={expense.reimbursed} onChange={() => handleReimbursedToggle(expense)} className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                          <span className={`text-[10px] font-bold ${expense.reimbursed ? 'text-emerald-600' : 'text-amber-600'}`}>{expense.reimbursed ? 'Paid' : 'Unpaid'}</span>
                        </label>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button type="button" onClick={() => setEditingExpense(expense)} className="p-1.5 text-slate-450 hover:text-indigo-650 hover:bg-slate-100 rounded-lg transition-all cursor-pointer active:scale-95" title="Edit expense" aria-label="Edit expense"><Edit3 className="w-4 h-4" aria-hidden="true" /></button>
                        <button type="button" onClick={() => expense.id && onDelete(expense.id)} className="p-1.5 text-slate-455 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer active:scale-95" title="Delete expense" aria-label="Delete expense"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                      </td>
                    </tr>
                    {expense.imageUrlBase64 && (
                      <tr className="border-none">
                        <td colSpan={8} className="p-0 border-none">
                          <div className="transition-all duration-300 ease-in-out overflow-hidden bg-slate-50/50" style={{ maxHeight: expandedReceiptId === expense.id ? '280px' : '0px', opacity: expandedReceiptId === expense.id ? 1 : 0 }}>
                            <div className="px-6 py-4 border-t border-b border-slate-100 flex items-center justify-between gap-4">
                              <div className="space-y-1 max-w-sm">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Receipt Image</span>
                              </div>
                              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white p-1 hover:border-indigo-400 transition-colors cursor-zoom-in group shadow-premium">
                                <img src={expense.imageUrlBase64} alt="Receipt Scan" className="max-h-[200px] w-auto object-contain rounded-lg shadow-2xs group-hover:opacity-90" onClick={() => setActiveReceiptImg(expense.imageUrlBase64 || null)} />
                              </div>
                              <button type="button" onClick={() => setExpandedReceiptId(null)} className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 shadow-2xs cursor-pointer">Collapse</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {monthExpenses.map((expense) => (
              <div key={expense.id} className="p-4 space-y-3 hover:bg-slate-55/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <h4 className="font-bold text-slate-900 text-sm leading-tight">{expense.vendor}</h4>
                    <p className="text-[10.5px] text-slate-400 font-mono">{formatFriendlyDate(expense.date)}</p>
                  </div>
                  <span className="font-black font-mono text-slate-900 text-base">{formatCurrency(expense.totalAmount, expense.currency)}</span>
                </div>

                {expense.description && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50/50 p-2 rounded-lg border border-slate-100/50">{expense.description}</p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border tracking-tight ${getCategoryColor(expense.category)}`}>{expense.category}</span>

                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer min-h-[44px] px-2" aria-label={`Mark ${expense.vendor} as ${expense.reimbursed ? 'Unpaid' : 'Paid'}`}>
                      <input type="checkbox" checked={expense.reimbursed} onChange={() => handleReimbursedToggle(expense)} className="w-5 h-5 rounded accent-indigo-600 cursor-pointer" />
                      <span className={`text-[10px] font-bold ${expense.reimbursed ? 'text-emerald-600' : 'text-amber-600'}`}>{expense.reimbursed ? 'Paid' : 'Unpaid'}</span>
                    </label>
                    {expense.imageUrlBase64 && (
                      <button type="button" onClick={() => toggleReceiptExpand(expense.id)} className="text-xs text-indigo-700 font-bold flex items-center gap-1 cursor-pointer hover:underline">
                        <Receipt className="w-3.5 h-3.5" />
                        {expandedReceiptId === expense.id ? 'Collapse' : 'Receipt'}
                      </button>
                    )}
                    <button type="button" onClick={() => setEditingExpense(expense)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg cursor-pointer active:scale-95 transition-all" aria-label="Edit expense"><Edit3 className="w-4 h-4" aria-hidden="true" /></button>
                    <button type="button" onClick={() => expense.id && onDelete(expense.id)} className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-slate-50 rounded-lg cursor-pointer active:scale-95 transition-all" aria-label="Delete expense"><Trash2 className="w-4 h-4" aria-hidden="true" /></button>
                  </div>
                </div>

                {expense.imageUrlBase64 && (
                  <div className="transition-all duration-300 ease-in-out overflow-hidden" style={{ maxHeight: expandedReceiptId === expense.id ? '220px' : '0px', opacity: expandedReceiptId === expense.id ? 1 : 0 }}>
                    <div className="pt-2 flex flex-col items-center">
                      <img src={expense.imageUrlBase64} alt="Receipt" className="max-h-48 rounded-lg object-contain border border-slate-200/80 p-0.5 bg-white shadow-premium cursor-zoom-in" onClick={() => setActiveReceiptImg(expense.imageUrlBase64 || null)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Edit Form Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-xl border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-800 flex items-center gap-2 font-heading tracking-tight">
                <FileText className="w-5 h-5 text-indigo-500" />Edit Expense
              </h3>
              <button type="button" onClick={() => setEditingExpense(null)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" aria-label="Close edit modal"><X className="w-5 h-5" aria-hidden="true" /></button>
            </div>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / Vendor</label>
                <input type="text" required value={editingExpense.vendor} onChange={(e) => setEditingExpense({ ...editingExpense, vendor: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Amount</label>
                  <input type="number" step="0.01" required value={editingExpense.totalAmount} onChange={(e) => setEditingExpense({ ...editingExpense, totalAmount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency</label>
                  <input type="text" required value={editingExpense.currency} onChange={(e) => setEditingExpense({ ...editingExpense, currency: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" required value={editingExpense.date} onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                  <select value={editingExpense.category} onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Travel">Travel</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Retail">Retail</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</label>
                <textarea rows={2} value={editingExpense.description} onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditingExpense(null)} className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"><Check className="w-4 h-4" />Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Lightbox */}
      {activeReceiptImg && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in no-print">
          <div className="relative max-w-3xl w-full flex flex-col items-center">
            <button type="button" onClick={() => setActiveReceiptImg(null)} className="absolute -top-12 right-0 p-2 text-white bg-slate-800/80 hover:bg-slate-700/85 rounded-full transition-all cursor-pointer active:scale-95" aria-label="Close receipt preview"><X className="w-5 h-5" aria-hidden="true" /></button>
            <div className="bg-slate-100 p-2 rounded-2xl shadow-2xl max-h-[80vh] overflow-hidden">
              <img src={activeReceiptImg} alt="Receipt scan" className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
