export interface Point {
  x: number;
  y: number;
}

function toGrayscale(src: ImageData): ImageData {
  const dst = new ImageData(src.width, src.height);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = 0.299 * src.data[i] + 0.587 * src.data[i + 1] + 0.114 * src.data[i + 2];
    dst.data[i] = v;
    dst.data[i + 1] = v;
    dst.data[i + 2] = v;
    dst.data[i + 3] = 255;
  }
  return dst;
}

function boxBlur(src: ImageData, radius: number): ImageData {
  const w = src.width, h = src.height;
  const dst = new ImageData(w, h);
  const r = Math.max(1, radius);
  const len = r * 2 + 1;
  const area = len * len;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const px = Math.min(w - 1, Math.max(0, x + kx));
          const py = Math.min(h - 1, Math.max(0, y + ky));
          sum += src.data[(py * w + px) * 4];
        }
      }
      const idx = (y * w + x) * 4;
      const v = sum / area;
      dst.data[idx] = v;
      dst.data[idx + 1] = v;
      dst.data[idx + 2] = v;
      dst.data[idx + 3] = 255;
    }
  }
  return dst;
}

function sobel(src: ImageData): { magnitude: Float64Array; width: number; height: number } {
  const w = src.width, h = src.height;
  const magnitude = new Float64Array(w * h);
  const gx = new Float64Array(w * h);
  const gy = new Float64Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const tl = src.data[((y - 1) * w + (x - 1)) * 4];
      const t = src.data[((y - 1) * w + x) * 4];
      const tr = src.data[((y - 1) * w + (x + 1)) * 4];
      const l = src.data[(y * w + (x - 1)) * 4];
      const r = src.data[(y * w + (x + 1)) * 4];
      const bl = src.data[((y + 1) * w + (x - 1)) * 4];
      const b = src.data[((y + 1) * w + x) * 4];
      const br = src.data[((y + 1) * w + (x + 1)) * 4];

      gx[idx] = -tl + tr - 2 * l + 2 * r - bl + br;
      gy[idx] = -tl - 2 * t - tr + bl + 2 * b + br;
      magnitude[idx] = Math.sqrt(gx[idx] * gx[idx] + gy[idx] * gy[idx]);
    }
  }

  return { magnitude, width: w, height: h };
}

function threshold(mag: Float64Array, w: number, h: number, low: number): ImageData {
  const dst = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = mag[i] > low ? 255 : 0;
    dst.data[i * 4] = v;
    dst.data[i * 4 + 1] = v;
    dst.data[i * 4 + 2] = v;
    dst.data[i * 4 + 3] = 255;
  }
  return dst;
}

function getEdgePoints(binary: ImageData, step: number = 2): Point[] {
  const pts: Point[] = [];
  for (let y = step; y < binary.height - step; y += step) {
    for (let x = step; x < binary.width - step; x += step) {
      if (binary.data[(y * binary.width + x) * 4] > 0) {
        pts.push({ x, y });
      }
    }
  }
  return pts;
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [];
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const denom = Math.sqrt(dx * dx + dy * dy);
  if (denom < 1e-10) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / denom;
}

function simplifyPolyline(pts: Point[], epsilon: number): Point[] {
  if (pts.length <= 2) return pts;
  let dmax = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax > epsilon) {
    const left = simplifyPolyline(pts.slice(0, idx + 1), epsilon);
    const right = simplifyPolyline(pts.slice(idx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [pts[0], pts[pts.length - 1]];
}

function getPolygonArea(pts: Point[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function orderCorners(pts: Point[]): Point[] {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const angles = pts.map(p => ({ ...p, angle: Math.atan2(p.y - cy, p.x - cx) }));
  angles.sort((a, b) => a.angle - b.angle);
  const ordered = angles.map(({ x, y }) => ({ x, y }));
  const tl = ordered.reduce((min, p) => p.x + p.y < min.x + min.y ? p : min);
  const idx = ordered.indexOf(tl);
  return [0, 1, 2, 3].map(i => ordered[(idx + i) % 4]);
}

function scalePoints(pts: Point[], sx: number, sy: number): Point[] {
  return pts.map(p => ({ x: p.x * sx, y: p.y * sy }));
}

function solveHomography(src: Point[], dst: Point[]): number[] {
  const A: number[] = [];
  for (let i = 0; i < 4; i++) {
    const sx = src[i].x, sy = src[i].y;
    const dx = dst[i].x, dy = dst[i].y;
    A.push(-sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx, dx);
    A.push(0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy, dy);
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[j * n + i]) > Math.abs(A[maxRow * n + i])) maxRow = j;
    }
    for (let k = i; k < n + 1; k++) [A[i * n + k], A[maxRow * n + k]] = [A[maxRow * n + k], A[i * n + k]];
    const pivot = A[i * n + i];
    if (Math.abs(pivot) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let k = i; k < n + 1; k++) A[i * n + k] /= pivot;
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        const factor = A[j * n + i];
        for (let k = i; k < n + 1; k++) A[j * n + k] -= factor * A[i * n + k];
      }
    }
  }
  return [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => A[i * n + n]);
}

function applyHomography(x: number, y: number, H: number[]): { x: number; y: number } {
  const denom = H[6] * x + H[7] * y + H[8];
  if (Math.abs(denom) < 1e-12) return { x: 0, y: 0 };
  return {
    x: (H[0] * x + H[1] * y + H[2]) / denom,
    y: (H[3] * x + H[4] * y + H[5]) / denom,
  };
}

function warpPerspective(
  srcData: ImageData,
  srcCorners: Point[],
  dstWidth: number,
  dstHeight: number
): ImageData {
  const dstData = new ImageData(dstWidth, dstHeight);
  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: dstWidth - 1, y: 0 },
    { x: dstWidth - 1, y: dstHeight - 1 },
    { x: 0, y: dstHeight - 1 },
  ];

  const H = solveHomography(dstCorners, srcCorners);

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const src = applyHomography(x, y, H);
      const sx = Math.round(src.x);
      const sy = Math.round(src.y);
      if (sx >= 0 && sx < srcData.width && sy >= 0 && sy < srcData.height) {
        const si = (sy * srcData.width + sx) * 4;
        const di = (y * dstWidth + x) * 4;
        dstData.data[di] = srcData.data[si];
        dstData.data[di + 1] = srcData.data[si + 1];
        dstData.data[di + 2] = srcData.data[si + 2];
        dstData.data[di + 3] = 255;
      }
    }
  }
  return dstData;
}

function enhanceContrast(imgData: ImageData): ImageData {
  let min = 255, max = 0;
  for (let i = 0; i < imgData.data.length; i += 4) {
    const gray = 0.299 * imgData.data[i] + 0.587 * imgData.data[i + 1] + 0.114 * imgData.data[i + 2];
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = max - min;
  if (range < 1) return imgData;
  const dst = new ImageData(imgData.width, imgData.height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    dst.data[i] = ((imgData.data[i] - min) / range) * 255;
    dst.data[i + 1] = ((imgData.data[i + 1] - min) / range) * 255;
    dst.data[i + 2] = ((imgData.data[i + 2] - min) / range) * 255;
    dst.data[i + 3] = 255;
  }
  return dst;
}

export function detectDocumentCorners(
  canvas: HTMLCanvasElement,
  downscaleForDetection: number = 0.5,
  blurRadius: number = 3,
  edgeThreshold: number = 25,
  simplifyEpsilon: number = 8
): Point[] | null {
  const sw = Math.round(canvas.width * downscaleForDetection);
  const sh = Math.round(canvas.height * downscaleForDetection);

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = sw;
  tempCanvas.height = sh;
  const tctx = tempCanvas.getContext('2d');
  if (!tctx) return null;
  tctx.drawImage(canvas, 0, 0, sw, sh);

  let imgData = tctx.getImageData(0, 0, sw, sh);
  imgData = toGrayscale(imgData);
  imgData = boxBlur(imgData, blurRadius);

  const { magnitude } = sobel(imgData);
  const binary = threshold(magnitude, sw, sh, edgeThreshold);

  const points = getEdgePoints(binary, 2);
  if (points.length < 10) return null;

  const hull = convexHull(points);
  if (hull.length < 4) return null;

  const simplified = simplifyPolyline(hull, simplifyEpsilon);
  const quad = simplified.length >= 4 ? simplified : hull;

  const best = findBestQuadrilateral(quad, sw, sh);
  if (!best) return null;

  const scaled = scalePoints(best, 1 / downscaleForDetection, 1 / downscaleForDetection);
  return orderCorners(scaled);
}

function findBestQuadrilateral(pts: Point[], w: number, h: number): Point[] | null {
  if (pts.length === 4) return pts;

  let best: Point[] | null = null;
  let bestArea = 0;

  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      for (let k = j + 1; k < pts.length; k++) {
        for (let l = k + 1; l < pts.length; l++) {
          const quad = orderCorners([pts[i], pts[j], pts[k], pts[l]]);
          const area = getPolygonArea(quad);
          if (area > bestArea) {
            bestArea = area;
            best = quad;
          }
        }
      }
    }
  }

  if (best && bestArea > w * h * 0.05) return best;
  return null;
}

export function extractAndEnhance(
  sourceCanvas: HTMLCanvasElement,
  corners: Point[]
): HTMLCanvasElement {
  const srcData = sourceCanvas.getContext('2d')!.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);

  const cw = sourceCanvas.width;
  const ch = sourceCanvas.height;

  const margin = 0.05;
  const mx = (margin) * cw;
  const my = (margin) * ch;

  const paddedCorners: Point[] = [
    { x: Math.max(0, corners[0].x - mx), y: Math.max(0, corners[0].y - my) },
    { x: Math.min(cw, corners[1].x + mx), y: Math.max(0, corners[1].y - my) },
    { x: Math.min(cw, corners[2].x + mx), y: Math.min(ch, corners[2].y + my) },
    { x: Math.max(0, corners[3].x - mx), y: Math.min(ch, corners[3].y + my) },
  ];

  const w1 = Math.sqrt((paddedCorners[1].x - paddedCorners[0].x) ** 2 + (paddedCorners[1].y - paddedCorners[0].y) ** 2);
  const w2 = Math.sqrt((paddedCorners[2].x - paddedCorners[3].x) ** 2 + (paddedCorners[2].y - paddedCorners[3].y) ** 2);
  const h1 = Math.sqrt((paddedCorners[3].x - paddedCorners[0].x) ** 2 + (paddedCorners[3].y - paddedCorners[0].y) ** 2);
  const h2 = Math.sqrt((paddedCorners[2].x - paddedCorners[1].x) ** 2 + (paddedCorners[2].y - paddedCorners[1].y) ** 2);

  const dstW = Math.round(Math.max(w1, w2));
  const dstH = Math.round(Math.max(h1, h2));

  const warped = warpPerspective(srcData, paddedCorners, dstW, dstH);
  const enhanced = enhanceContrast(warped);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = dstW;
  outCanvas.height = dstH;
  outCanvas.getContext('2d')!.putImageData(enhanced, 0, 0);

  return outCanvas;
}

export function drawCornerOverlay(
  canvas: HTMLCanvasElement,
  corners: Point[],
  color: string = '#4f46e5'
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || corners.length < 4) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i <= 4; i++) {
    ctx.lineTo(corners[i % 4].x, corners[i % 4].y);
  }
  ctx.stroke();

  ctx.setLineDash([]);
  const r = 6;
  for (const c of corners) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
