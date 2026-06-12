import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, AlertCircle, FileText } from 'lucide-react';
import { parseReceiptImage, ReceiptData } from '../lib/gemini';
import { compressAndToBase64 } from '../lib/utils';

interface ReceiptUploaderProps {
  onScanSuccess: (data: ReceiptData, imageBase64: string) => void;
}

export default function ReceiptUploader({ onScanSuccess }: ReceiptUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (file: File) => {
    if (!file) return;

    // Show instant visual preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setError(null);
    setLoading(true);

    try {
      setStatusMessage('Optimizing image resolutions...');
      const base64Img = await compressAndToBase64(file, 1200, 0.75);

      setStatusMessage('Analyzing details with Gemini AI...');
      const parsedData = await parseReceiptImage(file);

      setStatusMessage('Success!');
      // Send parsed data and compressed base64 to parent state
      onScanSuccess(parsedData, base64Img);
      
      // Reset uploader state
      setPreviewUrl(null);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Receipt parse failed:', message);
      setError(message || 'AI failed to process the receipt. Please try another photo or enter manually.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileChange(e.target.files[0]);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const triggerInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div id="receipt-uploader-root" className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-premium hover:shadow-premium-hover transition-shadow duration-300">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-indigo-100 text-indigo-600 rounded-xl shadow-2xs border border-indigo-100/50">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900 font-heading tracking-tight sm:text-base">Scan Receipts with AI</h2>
          <p className="text-xs text-slate-400">Capture with camera or drag receipt documents here</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 px-4 bg-rose-50/50 border border-rose-100/80 text-rose-800 rounded-xl flex items-start gap-3 text-xs animate-fade-in-up">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-0.5">
            <p className="font-bold">Receipt scan failed</p>
            <p className="text-rose-700 leading-normal">{error}</p>
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload receipt image for AI scanning"
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        onClick={!loading ? triggerInput : undefined}
        onKeyDown={!loading ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerInput(); } } : undefined}
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50/30 scale-[1.02] ring-4 ring-indigo-500/5 shadow-glow-indigo'
            : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/30'
        } ${loading ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onInputChange}
          className="hidden"
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4 py-4 w-full max-w-xs">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 animate-float">
              <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-full animate-ping opacity-60"></div>
            </div>
            
            <div className="space-y-1.5 w-full">
              <p className="text-xs font-bold text-slate-700">{statusMessage}</p>
              
              {/* Premium Slim Shimmering Progress Bar */}
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500 bg-shimmer rounded-full bg-[size:200%_100%]"></div>
              </div>
              <p className="text-[10px] text-slate-400 animate-pulse">Usually compiles in 3 to 5 seconds</p>
            </div>
          </div>
        ) : previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            <div className="relative p-1 bg-slate-100 rounded-xl shadow-xs border border-slate-200">
              <img
                src={previewUrl}
                alt="Scan capture preview"
                className="w-24 h-24 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-indigo-500/10 rounded-lg animate-pulse"></div>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-800">Processing Document</p>
              <p className="text-[10px] text-slate-400">Preparing offline buffer stream...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4.5">
            <div className="w-11 h-11 bg-slate-50 text-slate-500 border border-slate-100 rounded-2xl flex items-center justify-center hover:scale-105 hover:bg-white hover:border-slate-200 transition-all duration-300 shadow-2xs">
              <Upload className="w-4.5 h-4.5 text-slate-600" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600">
                <span className="text-indigo-600 font-bold hover:underline">Click to capture</span> or drag photo here
              </p>
              <p className="text-[10px] text-slate-400">Supports JPEG, Portable Image, and Mobile Document Capture</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4.5 flex items-center gap-2 text-[10.5px] text-slate-400 font-medium">
        <FileText className="w-3.5 h-3.5 text-slate-400" />
        <span>Indexed database and raw scans are locked on your local sandbox storage</span>
      </div>
    </div>
  );
}
