import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanLine, RotateCw, Check, X, Sparkles } from 'lucide-react';
import {
  detectDocumentCorners,
  extractAndEnhance,
  drawCornerOverlay,
  Point,
} from '../lib/scanner';

interface SmartScannerProps {
  onCapture: (croppedCanvas: HTMLCanvasElement, originalFile: File) => void;
  onClose: () => void;
}

export default function SmartScanner({ onCapture, onClose }: SmartScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);
  const [corners, setCorners] = useState<Point[] | null>(null);
  const [flash, setFlash] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setLoading(false);
    } catch {
      setError('Camera access denied. Please allow camera permissions or use the file upload option.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(animationRef.current);
    };
  }, [startCamera]);

  const detectLoop = useCallback(() => {
    if (captured) return;
    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;
    if (!video || !overlay || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectLoop);
      return;
    }

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tctx = tempCanvas.getContext('2d');
    if (!tctx) return;
    tctx.drawImage(video, 0, 0);

    const detected = detectDocumentCorners(tempCanvas);
    setCorners(detected);

    if (detected && overlay) {
      drawCornerOverlay(overlay, detected, '#4f46e5');
    }

    animationRef.current = requestAnimationFrame(detectLoop);
  }, [captured]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(detectLoop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [detectLoop]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;

    setFlash(true);
    setTimeout(() => setFlash(false), 200);

    setCaptured(true);
    cancelAnimationFrame(animationRef.current);

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
  };

  const handleRetake = () => {
    setCaptured(false);
    setCorners(null);
    animationRef.current = requestAnimationFrame(detectLoop);
  };

  const handleConfirm = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    let resultCanvas: HTMLCanvasElement;
    if (corners && corners.length === 4) {
      resultCanvas = extractAndEnhance(canvas, corners);
    } else {
      resultCanvas = document.createElement('canvas');
      resultCanvas.width = canvas.width;
      resultCanvas.height = canvas.height;
      resultCanvas.getContext('2d')!.drawImage(canvas, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(resultCanvas, file);
    }, 'image/jpeg', 0.95);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white z-10">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-indigo-400" />
          <span className="text-sm font-bold">Smart Document Scanner</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          aria-label="Close scanner"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-slate-800 rounded-2xl p-6 max-w-sm text-center space-y-4">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm cursor-pointer"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Starting camera...</p>
          </div>
        </div>
      )}

      {/* Viewfinder */}
      {!loading && !error && (
        <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain ${captured ? 'hidden' : ''}`}
          />

          <canvas
            ref={previewCanvasRef}
            className={`w-full h-full object-contain ${captured ? '' : 'hidden'}`}
          />

          <canvas
            ref={overlayCanvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${captured ? 'hidden' : ''}`}
          />

          {flash && <div className="absolute inset-0 bg-white animate-fade-in pointer-events-none" />}

          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-[80%] h-[60%] border-2 border-white/30 rounded-2xl relative">
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-indigo-400 rounded-tl-xl" />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-indigo-400 rounded-tr-xl" />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-indigo-400 rounded-bl-xl" />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-indigo-400 rounded-br-xl" />
              </div>
            </div>
          </div>

          {!captured && corners && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 pointer-events-none">
              <Sparkles className="w-3 h-3" />
              Document detected
            </div>
          )}
        </div>
      )}

      {/* Controls */}
      {!loading && !error && (
        <div className="px-4 py-5 bg-black/80 flex items-center justify-center gap-6">
          {!captured ? (
            <button
              type="button"
              onClick={handleCapture}
              className="w-16 h-16 rounded-full bg-white hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
              aria-label="Capture document"
            >
              <div className="w-14 h-14 rounded-full border-2 border-black" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetake}
                className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center">
                  <RotateCw className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold">Retake</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex flex-col items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <Check className="w-6 h-6 text-white" />
                </div>
                <span className="text-[10px] font-semibold">Use Photo</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
