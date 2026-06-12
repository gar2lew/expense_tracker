import React, { useRef, useState } from 'react';
import { exportExpensesToJSON, importExpensesFromJSON } from '../lib/backup';
import { Download, Upload, Database } from 'lucide-react';

interface DataBackupProps {
  onBackupSuccess: (message: string) => void;
  onBackupError: (message: string) => void;
  onImportComplete: () => void;
}

export default function DataBackup({ onBackupSuccess, onBackupError, onImportComplete }: DataBackupProps) {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      await exportExpensesToJSON();
      onBackupSuccess('Your local expense database was successfully bundled and downloaded as JSON!');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      onBackupError(message || 'Export failed. Local system error.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    setLoading(true);
    try {
      const recordsCount = await importExpensesFromJSON(file);
      onBackupSuccess(`Successfully loaded and verified ${recordsCount} expense claims into local database!`);
      onImportComplete();
      
      // Reset input element value to allow same-file re-imports if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      onBackupError(message || 'Verification of backup structure failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="data-backup-root" className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden no-print">
      
      {/* Header Panel Accordion Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-slate-50/20 transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Database className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Local Database & Backups</h3>
            <p className="text-xs text-slate-400">Export claims or load external standard backups</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold bg-slate-100 px-2 py-0.5 rounded-full">
            {isOpen ? 'Collapse' : 'Manage'}
          </span>
        </div>
      </button>

      {/* Settings Options container */}
      {isOpen && (
        <div className="p-5 border-t border-slate-100 bg-slate-50/30 space-y-4 animate-fade-in text-xs text-slate-600 leading-relaxed">
          <p>
            This applet operates in fully sandboxed <strong className="text-indigo-600">Offline-First</strong> mode. All scanned paper documents, prices, and visual meta parameters reside safely inside your local browser. Use these options to secure external file copies.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            
            {/* Export Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-between items-start gap-3">
              <div>
                <span className="font-semibold text-slate-800 block mb-0.5 text-xs">Export Sandbox</span>
                <span className="text-[10px] text-slate-400 block">Download all claims and compressed receipt images in unified JSON.</span>
              </div>
              <button
                type="button"
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all text-xs cursor-pointer disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                Bundle to JSON Backup
              </button>
            </div>

            {/* Import Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs flex flex-col justify-between items-start gap-3">
              <div>
                <span className="font-semibold text-slate-800 block mb-0.5 text-xs">Load Backup File</span>
                <span className="text-[10px] text-slate-400 block">Upload a previously exported JSON backup to reconstruct or merge transaction indexes.</span>
              </div>
              <div className="flex items-center gap-2 w-full">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  onChange={handleFileImport}
                  className="hidden"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleImportClick}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold rounded-lg transition-all text-xs cursor-pointer disabled:opacity-40"
                >
                  <Upload className="w-3.5 h-3.5 animate-pulse" />
                  Upload Backup File
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
