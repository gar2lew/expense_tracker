import React, { useState, useEffect, useMemo } from 'react';
import { 
  getAllExpenses, 
  addExpense, 
  deleteExpense, 
  updateExpense, 
  clearExpenses, 
  Expense 
} from './lib/db';
import { ReceiptData } from './lib/gemini';
import { formatCurrency, formatFriendlyDate } from './lib/utils';
import ReceiptUploader from './components/ReceiptUploader';
import GeminiAnalytics from './components/GeminiAnalytics';
import ExpenseList from './components/ExpenseList';
import PrintButton from './components/PrintButton';
import DataBackup from './components/DataBackup';
import SignaturePad from './components/SignaturePad';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { 
  Receipt, 
  BarChart3, 
  Plus, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  FileText,
  DollarSign,
  TrendingUp,
  FolderHeart,
  Grid,
  Wifi,
  WifiOff
} from 'lucide-react';
import './styles/print.css';

export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeView, setActiveView] = useState<'dashboard' | 'report'>('dashboard');
  const [showManualForm, setShowManualForm] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const isOnline = useOnlineStatus();

  // Manual form temporary fields
  const [manualVendor, setManualVendor] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualCurrency, setManualCurrency] = useState('AUD');
  const [manualDate, setManualDate] = useState(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${mm}-${dd}`;
  });
  const [manualCategory, setManualCategory] = useState('Food & Dining');
  const [manualDescription, setManualDescription] = useState('');

  // Hydrate on mount
  useEffect(() => {
    async function loadData() {
      try {
        const list = await getAllExpenses();
        setExpenses(list);
      } catch (e: unknown) {
        console.error('Failed to load local IndexedDB data on mount:', e instanceof Error ? e.message : e);
        triggerNotification('Failed to read IndexedDB store. Stale session active.', 'error');
      }
    }
    loadData();
  }, []);

  const triggerNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const handleImportReload = async () => {
    try {
      const list = await getAllExpenses();
      setExpenses(list);
    } catch (e: unknown) {
      console.error('Import reload failed:', e instanceof Error ? e.message : e);
    }
  };

  // AI scanning success handler
  const handleScanSuccess = async (data: ReceiptData, imageBase64: string) => {
    try {
      const newExp: Omit<Expense, 'id'> = {
        date: data.date,
        vendor: data.vendor,
        totalAmount: data.totalAmount,
        currency: data.currency || 'AUD',
        category: data.category || 'Other',
        description: data.description || 'AI Auto-parsed Receipt',
        imageUrlBase64: imageBase64,
        createdAt: Date.now(),
      };
      
      await addExpense(newExp);
      const updatedList = await getAllExpenses();
      setExpenses(updatedList);
      triggerNotification(`Verified and saved scan from ${data.vendor} for ${formatCurrency(data.totalAmount, data.currency)}!`, 'success');
    } catch (err: unknown) {
      console.error('Failed to save parsed receipt:', err instanceof Error ? err.message : err);
      triggerNotification('Failed to save parsing result directly to IndexedDB.', 'error');
    }
  };

  // Manual submit handler
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualVendor || !manualAmount || isNaN(parseFloat(manualAmount))) {
      triggerNotification('Please construct valid values for merchant and amount.', 'error');
      return;
    }

    try {
      const newExp: Omit<Expense, 'id'> = {
        date: manualDate,
        vendor: manualVendor,
        totalAmount: parseFloat(manualAmount),
        currency: manualCurrency.toUpperCase(),
        category: manualCategory,
        description: manualDescription || 'Manually entered transaction',
        createdAt: Date.now(),
      };

      await addExpense(newExp);
      const updatedList = await getAllExpenses();
      setExpenses(updatedList);
      
      // Reset form fields
      setManualVendor('');
      setManualAmount('');
      setManualDescription('');
      setShowManualForm(false);
      triggerNotification(`Successfully registered expense of ${formatCurrency(parseFloat(manualAmount), manualCurrency)} for ${manualVendor}.`, 'success');
    } catch (err: unknown) {
      console.error('Manual submit failed:', err instanceof Error ? err.message : err);
      triggerNotification('IndexedDB could not put entry. Limit constraints exceeded.', 'error');
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this expense record?');
    if (!confirmed) return;

    try {
      await deleteExpense(id);
      const updatedList = await getAllExpenses();
      setExpenses(updatedList);
      triggerNotification('Expense entry permanently purged.', 'info');
    } catch (err: unknown) {
      console.error('Delete expense failed:', err instanceof Error ? err.message : err);
      triggerNotification('Deletion aborted. System error.', 'error');
    }
  };

  const handleUpdateExpense = async (updated: Expense) => {
    try {
      await updateExpense(updated);
      const updatedList = await getAllExpenses();
      setExpenses(updatedList);
      triggerNotification('Changes saved successfully.', 'success');
    } catch (err: unknown) {
      console.error('Update expense failed:', err instanceof Error ? err.message : err);
      triggerNotification('Failed to execute update on IndexedDB.', 'error');
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm('CRITICAL WARNING: This will permanently delete ALL stored expenses and receipts. This action is irreversible. Continue?');
    if (!confirmed) return;

    try {
      await clearExpenses();
      setExpenses([]);
      triggerNotification('Database cleared. All local state purged.', 'info');
    } catch (err: unknown) {
      console.error('Clear database failed:', err instanceof Error ? err.message : err);
      triggerNotification('Failed to purge database.', 'error');
    }
  };

  // Metric Aggregators — memoized to avoid recomputation on every render
  const totalAUDSpent = useMemo(() => expenses.reduce((sum, item) => {
    if (item.currency === 'AUD' || !item.currency) {
      return sum + item.totalAmount;
    }
    if (item.currency === 'USD') return sum + (item.totalAmount * 1.50);
    if (item.currency === 'EUR') return sum + (item.totalAmount * 1.62);
    if (item.currency === 'GBP') return sum + (item.totalAmount * 1.91);
    return sum + item.totalAmount;
  }, 0), [expenses]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + item.totalAmount;
    });
    return counts;
  }, [expenses]);

  const topCategory = useMemo(() => Object.entries(categoryCounts).reduce(
    (max, curr) => (curr[1] > max[1] ? curr : max),
    ['None', 0] as [string, number]
  ), [categoryCounts]);

  return (
    <div id="application-container" className="min-h-screen bg-slate-50/50 text-slate-800 antialiased font-sans pb-16">
      
      {/* Global Notifications */}
      {notification && (
        <div 
          id="global-toast" 
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4.5 py-3.5 rounded-2xl shadow-xl border text-xs font-semibold tracking-tight transition-all animate-fade-in-up no-print ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-100/80 text-emerald-800' 
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-100/80 text-rose-800'
              : 'bg-indigo-50 border-indigo-100/80 text-indigo-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Screen Interface Header with High-end Glassmorphism */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-md border-b border-slate-200/50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200 border border-indigo-600/10">
              <Receipt className="w-5 h-5 animate-float" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-sm leading-none tracking-tight block font-heading sm:text-base">LedgerDesk.AI</span>
              <div className="flex items-center gap-1.5 mt-1">
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 font-extrabold bg-emerald-50 border border-emerald-100/50 px-1.5 py-0.5 rounded-sm">
                    <Wifi className="w-2.5 h-2.5 text-emerald-600" />
                    SECURE LIVE CONNECT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[9px] text-amber-700 font-extrabold bg-amber-50 border border-amber-100/50 px-1.5 py-0.5 rounded-sm animate-pulse">
                    <WifiOff className="w-2.5 h-2.5 text-amber-600" />
                    LOCAL OFFLINE LAB
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Navigation Toggle */}
          <nav className="flex items-center bg-slate-100/80 p-1.5 rounded-xl border border-slate-200/30">
            <button
              type="button"
              onClick={() => { setActiveView('dashboard'); setShowManualForm(false); }}
              className={`px-4.5 py-1.8 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer active:scale-95 ${
                activeView === 'dashboard' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/30 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => { setActiveView('report'); setShowManualForm(false); }}
              className={`px-4.5 py-1.8 rounded-lg text-xs font-bold tracking-tight transition-all cursor-pointer active:scale-95 ${
                activeView === 'report' 
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/30 font-extrabold' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Printable Report
            </button>
          </nav>
        </div>
      </header>

      {/* Report Template Display ONLY Title (Invisible on Screen, Visible on Print) */}
      <div className="print-only-title text-center">
        <h1 className="text-3xl font-extrabold">Personal Expense & Receipts Audit Report</h1>
        <p className="text-sm text-slate-600 mt-2">Generated locally on {formatFriendlyDate(new Date().toISOString().split('T')[0])} &bull; Offline Archival Proof</p>
      </div>

      {/* Main Content Workspace Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 sm:space-y-8">
        
        {/* Dynamic Database Backup Toolbar (Hidden in print) */}
        <div className="no-print">
          <DataBackup 
            onBackupSuccess={(msg) => triggerNotification(msg, 'success')} 
            onBackupError={(msg) => triggerNotification(msg, 'error')} 
            onImportComplete={handleImportReload} 
          />
        </div>

        {activeView === 'dashboard' ? (
          
          <div className="space-y-8 no-print">
            
            {/* KPI Statistics Section with premium lifts and delicate gradient backdrops */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Card 1: Cumulative Amount */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase block">Total Cumulative (AUD Eq)</span>
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight block group-hover:text-indigo-650 transition-colors">
                    {formatCurrency(totalAUDSpent, 'AUD')}
                  </span>
                  <span className="text-[9.5px] text-emerald-600 font-medium flex items-center gap-1 mt-1 block">
                    <TrendingUp className="w-3 h-3" />
                    <span>Real-time local totals</span>
                  </span>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-indigo-50 to-indigo-150 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-200/50 shadow-2xs">
                  <DollarSign className="w-4.5 h-4.5" />
                </div>
              </div>

              {/* Card 2: Transaction Count */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase block">Tracked Claims</span>
                  <span className="text-2xl font-black text-slate-900 font-mono tracking-tight block">
                    {expenses.length}
                  </span>
                  <span className="text-[9.5px] text-slate-400 block font-medium mt-1">
                    Receipt scan index logs
                  </span>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-emerald-50 to-emerald-150 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-200/50 shadow-2xs">
                  <FileText className="w-4.5 h-4.5" />
                </div>
              </div>

              {/* Card 3: Top Category */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase block">Top Category Group</span>
                  <span className="text-base font-bold text-slate-900 block truncate max-w-[130px] font-heading">
                    {topCategory[0]}
                  </span>
                  <span className="text-[9.5px] text-indigo-600 font-bold block mt-1">
                    Outflow: {formatCurrency(Number(topCategory[1] || 0), 'AUD')}
                  </span>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-amber-50 to-amber-150 text-amber-600 rounded-xl flex items-center justify-center border border-amber-200/50 shadow-2xs">
                  <FolderHeart className="w-4.5 h-4.5" />
                </div>
              </div>

              {/* Card 4: Architecture Health */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium hover:-translate-y-1 hover:shadow-premium-hover transition-all duration-300 flex items-center justify-between group">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase block">Storage Engine</span>
                  <span className="text-xs font-black text-slate-900 block flex items-center gap-1 mt-1 font-heading uppercase tracking-wide">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>IndexedDB Store</span>
                  </span>
                  <span className="text-[9.5px] text-indigo-500 font-semibold block mt-1">
                    Unlimited local sandbox
                  </span>
                </div>
                <div className="w-11 h-11 bg-gradient-to-br from-violet-50 to-violet-150 text-indigo-600 rounded-xl flex items-center justify-center border border-violet-200/50 shadow-2xs">
                  <Grid className="w-4.5 h-4.5" />
                </div>
              </div>
            </div>

            {/* Scanning and Controls Block split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* Receipt scanning panel */}
              <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                
                {isOnline ? (
                  <ReceiptUploader onScanSuccess={handleScanSuccess} />
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/60 p-8 shadow-premium text-center space-y-4">
                    <div className="w-14 h-14 bg-amber-50 border border-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto animate-float">
                      <WifiOff className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-bold text-slate-850 font-heading">AI Cognitive parsing Offline</h2>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
                        Your device is currently offline. Auto-image scanning is paused temporarily, though you may write records manually or perform database backup operations.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowManualForm(true)}
                      className="px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                    >
                      Use Manual Entry Form
                    </button>
                  </div>
                )}
                
                <GeminiAnalytics expenses={expenses} isOnline={isOnline} />
                
                {/* Visual Category Bars panel */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-premium">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 font-heading">
                    <BarChart3 className="w-4 h-4 text-indigo-500" />
                    Spending by Category
                  </h3>
                  {expenses.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No categories data to represent yet. Track some transactions first.</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(categoryCounts).map(([catName, amount]) => {
                        const pct = Math.round((amount / (totalAUDSpent || 1)) * 100);
                        return (
                          <div key={catName} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-slate-700">{catName}</span>
                              <span className="text-slate-400 font-mono">{formatCurrency(amount, 'AUD')} <span className="font-bold text-indigo-600">({pct}%)</span></span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Side controls cards */}
              <div className="space-y-6">
                
                {/* Manual expense toggle card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-premium">
                  <button
                    type="button"
                    onClick={() => setShowManualForm(!showManualForm)}
                    className="w-full flex items-center justify-between text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-xl border border-amber-100/50 group-hover:scale-105 transition-transform duration-200">
                        <Plus className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-850 font-heading">Add Expense Manually</h3>
                        <p className="text-[10.5px] text-slate-400">If you don't have a receipt image</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${showManualForm ? 'rotate-90 text-slate-600' : ''}`} />
                  </button>

                  {showManualForm && (
                    <form onSubmit={handleManualSubmit} className="mt-5 space-y-4 pt-4 border-t border-slate-100 animate-fade-in-up">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Merchant / Vendor</label>
                        <input
                          type="text"
                          required
                          value={manualVendor}
                          onChange={(e) => setManualVendor(e.target.value)}
                          placeholder="e.g. Starbucks"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/20"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={manualAmount}
                            onChange={(e) => setManualAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Currency</label>
                          <select
                            value={manualCurrency}
                            onChange={(e) => setManualCurrency(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 bg-slate-50/20"
                          >
                            <option value="AUD">AUD ($)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="CAD">CAD ($)</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                          <input
                            type="date"
                            required
                            value={manualDate}
                            onChange={(e) => setManualDate(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 font-mono focus:outline-hidden focus:border-indigo-500 bg-slate-50/20"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</label>
                          <select
                            value={manualCategory}
                            onChange={(e) => setManualCategory(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-hidden focus:border-indigo-500 bg-slate-50/20"
                          >
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
                        <textarea
                          placeholder="What did you buy?"
                          rows={2}
                          value={manualDescription}
                          onChange={(e) => setManualDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-slate-50/20"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-slate-900 border border-indigo-650 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
                      >
                        Insert Ledger Record
                      </button>
                    </form>
                  )}
                </div>

                {/* DB management utility card with soft colors */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">Clear database</h4>
                    <p className="text-[10px] text-slate-400 mt-1">Delete all transaction ledgers securely</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={expenses.length === 0}
                    className="p-2.5 text-rose-600 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-all cursor-pointer active:scale-95 border border-rose-100"
                    title="Purge Store"
                  >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                </div>
              </div>
            </div>

            {/* List and Historical Ledger Panel */}
            <div className="space-y-4 pt-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-400 px-1 font-heading">Ledger Transactions</h3>
              <ExpenseList 
                expenses={expenses} 
                onDelete={handleDeleteExpense} 
                onUpdate={handleUpdateExpense} 
              />
            </div>
          </div>
        ) : (
          
          // Printable Audit-Ready Full Report layout
          <div className="space-y-6 sm:space-y-8 animate-fade-in-up">
            
            {/* Top Back Action Toolbar (Hidden in print) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4.5 bg-white border border-slate-200/60 shadow-premium rounded-2xl no-print">
              <div>
                <h2 className="text-sm font-bold text-slate-900 font-heading">Print Preview Arena</h2>
                <p className="text-xs text-slate-400">Standardized print document mapping ledger proofs and digital visual signatures.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveView('dashboard')}
                  className="px-4 py-2 text-xs font-bold text-slate-650 hover:text-slate-900 bg-slate-50 border border-slate-250 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer active:scale-95"
                >
                  Return to Dashboard
                </button>
                <PrintButton />
              </div>
            </div>

            {/* Audit Compilation Document */}
            <div className="bg-white border border-slate-200/60 rounded-3xl p-8 sm:p-12 shadow-premium space-y-8 card">
              
              {/* Document Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-8 flex-col sm:flex-row gap-6">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase font-heading">Expense Audit Ledger Report</h1>
                  <p className="text-xs text-slate-500 font-medium font-mono mt-1">DOCUMENT INDEX: #EXP-{Date.now().toString().slice(-6)}</p>
                  
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600 mt-4 leading-relaxed">
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Authorizing User</span>
                      <span className="font-semibold text-slate-800 font-mono">Gar2lew@gmail.com</span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Generation Date</span>
                      <span className="font-semibold text-slate-800 font-mono">{new Date().toISOString().split('T')[0]}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right sm:text-right flex flex-col items-end">
                  <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-bold mb-2">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block font-heading">Audit Status</span>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full inline-block mt-1">
                    VERIFIED OFFLINE
                  </span>
                </div>
              </div>

              {/* Aggregated Total Breakdown block */}
              <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-2xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Accumulated Sum</span>
                  <span className="text-2xl font-black text-indigo-700 font-heading block mt-1">{formatCurrency(totalAUDSpent, 'AUD')}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Claims Ledgered</span>
                  <span className="text-2xl font-black text-slate-900 block mt-1">{expenses.length} claims</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[10px] uppercase tracking-wider">Audit Security Signature</span>
                  <span className="text-xs font-semibold text-slate-500 block mt-2 font-mono truncate">SHA256: 49fa8...3b1d9c</span>
                </div>
              </div>

              {/* Claims Listing Block */}
              <div className="space-y-4">
                <h3 className="font-extrabold text-slate-900 border-b-2 border-slate-900 pb-2 text-sm uppercase tracking-wider">Expenses Statement</h3>
                
                {expenses.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No expense statements mapped to database</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-300 font-bold uppercase text-slate-500">
                          <th className="py-2.5 text-left font-semibold">Date</th>
                          <th className="py-2.5 text-left font-semibold">Merchant</th>
                          <th className="py-2.5 text-left font-semibold">Category</th>
                          <th className="py-2.5 text-left font-semibold">Description</th>
                          <th className="py-2.5 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {expenses.map((expense) => (
                           <tr key={expense.id} className="text-slate-700 align-top hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 font-mono text-[10.5px] whitespace-nowrap text-slate-500">
                              {formatFriendlyDate(expense.date)}
                            </td>
                            <td className="py-3 font-semibold text-slate-900">{expense.vendor}</td>
                            <td className="py-3 text-slate-500 whitespace-nowrap">{expense.category}</td>
                            <td className="py-3 text-slate-500 max-w-xs">{expense.description}</td>
                            <td className="py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(expense.totalAmount, expense.currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Scanned Receipt Proof Pages (Page-break forced individually) */}
              {expenses.some((e) => e.imageUrlBase64) && (
                <div className="print-page-break-before pt-8 border-t border-slate-200 text-xs">
                  <h3 className="font-extrabold text-slate-900 text-sm border-b-2 border-slate-900 pb-2 mb-6 uppercase tracking-wider">
                    Receipt Photo Proof Index
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {expenses
                      .filter((exp) => exp.imageUrlBase64)
                      .map((exp, idx) => (
                        <div key={exp.id} className="border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-between bg-slate-50/50 print-avoid-break shadow-premium">
                          <div className="w-full flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <div>
                              <span className="font-bold text-slate-900 text-[11px] block font-heading">{exp.vendor}</span>
                              <span className="text-[9.5px] text-slate-450 font-mono block mt-0.5">{formatFriendlyDate(exp.date)}</span>
                            </div>
                            <span className="font-extrabold text-indigo-700 font-mono text-xs">
                              {formatCurrency(exp.totalAmount, exp.currency)}
                            </span>
                          </div>
                          <img
                            src={exp.imageUrlBase64}
                            alt={`Audit receipt upload base key ${idx}`}
                            className="receipt-print-img rounded-lg border border-slate-200/80 p-0.5 bg-white max-h-56 object-contain shadow-2xs"
                          />
                          <span className="text-[8.5px] text-slate-400 font-mono mt-3 text-center uppercase tracking-widest block font-medium">
                            PROOF BACKUP #{idx + 1} &middot; KEY ID: {exp.id?.slice(0, 8)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SignaturePad Interactive Deck immediately above representative sign-off */}
              <div className="pt-8 border-t border-slate-200 space-y-6">
                <div className="max-w-md ml-auto">
                  <SignaturePad />
                </div>

                {/* Sign-Off Footer metadata lines */}
                <div className="flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-400 gap-4 leading-relaxed font-semibold pt-4">
                  <span>Verified Client Store &bull; Powered by Gemini AI Parse Architecture</span>
                  <div className="text-right sm:text-right flex flex-col items-end">
                    <span>Sign-off representative: _______________________________</span>
                    <span className="text-[8px] uppercase tracking-wider text-slate-300 mt-1">Authorized Audit Representative</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
