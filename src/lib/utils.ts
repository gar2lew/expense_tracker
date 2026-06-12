import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Formats a number to currency string safely.
 */
export function formatCurrency(amount: number, currencyCode: string = 'AUD'): string {
  try {
    return new Intl.NumberFormat(window.navigator.language || 'en-AU', {
      style: 'currency',
      currency: currencyCode || 'AUD',
    }).format(amount);
  } catch {
    return `${currencyCode || '$'} ${amount.toFixed(2)}`;
  }
}

/**
 * Formats date string to friendly readable DD/MM/YYYY text.
 */
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  const dateObj = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(dateObj.getTime())) return dateStr;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Renders the first page of a PDF file onto a high-resolution canvas.
 * Uses scale 2.0 to ensure Gemini OCR receives crisp text.
 */
async function renderPdfToCanvas(file: File): Promise<HTMLCanvasElement> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for PDF canvas render');
  }

  await page.render({ canvas, viewport }).promise;

  return canvas;
}

/**
 * Resizes a source canvas to fit within maxDimension on the longest edge
 * and exports it as a compressed JPEG base64 data URL.
 */
function resizeCanvasToJPEG(
  source: HTMLCanvasElement | HTMLImageElement,
  maxDimension: number,
  quality: number
): string {
  let width: number;
  let height: number;

  if (source instanceof HTMLCanvasElement) {
    width = source.width;
    height = source.height;
  } else {
    width = source.naturalWidth || source.width;
    height = source.naturalHeight || source.height;
  }

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get 2D context for resize canvas');
  }

  ctx.drawImage(source, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Compresses an image or PDF file by resizing it to a maximum of 1200px on its longest edge
 * and converts it to a compressed JPEG Base64 data URL.
 *
 * Accepts raster images (PNG, JPEG, WebP, etc.) loaded via Image() and PDFs rendered
 * via pdfjs-dist (first page only, at 2x scale for OCR quality).
 */
export function compressAndToBase64(
  file: File,
  maxDimension: number = 1200,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'application/pdf') {
      renderPdfToCanvas(file)
        .then((pdfCanvas) => {
          try {
            const dataUrl = resizeCanvasToJPEG(pdfCanvas, maxDimension, quality);
            resolve(dataUrl);
          } catch (e) {
            reject(e);
          }
        })
        .catch(reject);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const dataUrl = resizeCanvasToJPEG(img, maxDimension, quality);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image into element to resize.'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file as Data URL'));
    reader.readAsDataURL(file);
  });
}
