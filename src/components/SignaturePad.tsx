import React, { useRef, useEffect, useState } from 'react';
import { Trash2, CheckCircle2, FileSignature } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange?: (base64Img: string | null) => void;
}

export default function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [savedSig, setSavedSig] = useState<string | null>(null);

  // Initialize and load saved state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('user_signature');
    if (stored) {
      setSavedSig(stored);
      if (onSignatureChange) onSignatureChange(stored);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set high resolution bounding
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      canvas.width = (rect?.width || 400) * 2;
      canvas.height = 160 * 2;
      canvas.style.width = '100%';
      canvas.style.height = '160px';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(2, 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#1e1b4b'; // Deep navy stroke
        ctx.lineWidth = 2.5;

        // If saved, draw existing back
        if (stored) {
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, rect?.width || 400, 160);
          };
          img.src = stored;
        }
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCoordinates(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
    }
  };

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    
    // Check Touch vs Mouse coordinates
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    localStorage.removeItem('user_signature');
    setSavedSig(null);
    if (onSignatureChange) onSignatureChange(null);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export styled, flattened data URL with high-quality ratio
    // To ensure signature is cropped or exported cleanly, read from original high density pixels
    try {
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem('user_signature', dataUrl);
      setSavedSig(dataUrl);
      if (onSignatureChange) onSignatureChange(dataUrl);
    } catch (e) {
      console.error('Failed to export canvas signature:', e);
    }
  };

  return (
    <div ref={containerRef} className="space-y-3 print:border-none print-avoid-break">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 no-print">
          <FileSignature className="w-3.5 h-3.5 text-indigo-500" />
          Interactive Sign-off Authorization
        </label>
        <span className="text-[10px] text-slate-400 italic no-print">(Sign using touch or cursor below)</span>
      </div>

      <div className="relative group bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Signature pad — use mouse or touch to sign"
          tabIndex={0}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="block bg-slate-50/50 cursor-crosshair touch-none print:bg-white"
        />

        {/* Display Badge if saved signature exists */}
        {savedSig && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-[10px] font-semibold text-indigo-700 rounded-full select-none animate-fade-in no-print">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
            Saved Locally
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 no-print">
        <button
          type="button"
          onClick={clearCanvas}
          aria-label="Clear signature"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50/40 rounded-lg border border-slate-200/80 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          Reset / Clear
        </button>

        <button
          type="button"
          onClick={saveSignature}
          aria-label="Save signature"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors cursor-pointer ml-auto"
        >
          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          Lock and Validate
        </button>
      </div>
    </div>
  );
}
