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
  // Split input if conforming to YYYY-MM-DD
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
 * Compresses an image file by resizing it to a maximum of 1200px on its longest edge
 * and converts it to a compressed JPEG Base64 string.
 */
export function compressAndToBase64(file: File, maxDimension: number = 1200, quality: number = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Apply resize logic if image is larger than max dimension
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
          reject(new Error('Failed to get 2D context from canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with chosen quality
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          // Return only base64 string without data:image/jpeg;base64, header if we want, or full header
          // Let's store full dataUrl because it is easier to read in <img src="..." />
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
