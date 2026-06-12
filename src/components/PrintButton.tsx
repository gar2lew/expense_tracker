import { Printer, HelpCircle } from 'lucide-react';

interface PrintButtonProps {
  label?: string;
  className?: string;
}

export default function PrintButton({ label = 'Print Expense Report', className = '' }: PrintButtonProps) {
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-2 no-print">
      <button
        type="button"
        onClick={triggerPrint}
        aria-label="Print expense report"
        className={`inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-xs transition-all pointer-events-auto cursor-pointer ${className}`}
      >
        <Printer className="w-5 h-5 animate-pulse" aria-hidden="true" />
        <span>{label}</span>
      </button>

      <div className="flex items-start gap-1 pb-1 pt-2 px-1 text-[11px] text-slate-400 max-w-sm">
        <HelpCircle className="w-3.5 h-3.5 text-slate-300 mt-0.5 shrink-0" />
        <p className="leading-normal">
          <span className="font-semibold text-slate-500">Pro Tip:</span> For the cleanest results, check "Save as PDF" and <span className="font-semibold text-slate-500">enable "Background graphics"</span> in your browser's print options preview.
        </p>
      </div>
    </div>
  );
}
