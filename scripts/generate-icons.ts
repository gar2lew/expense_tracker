import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';

function createPNG(width: number, height: number, bgR: number, bgG: number, bgB: number): Buffer {
  const IHDR = createIHDR(width, height);
  const IDAT = createIDAT(width, height, bgR, bgG, bgB);
  const IEND = createIEND();

  const crc32 = (buf: Buffer): number => {
    let crc = 0xffffffff;
    const table = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c;
    }
    for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Buffer): Buffer => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
    return Buffer.concat([len, typeB, data, crcBuf]);
  };

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk('IHDR', IHDR), chunk('IDAT', IDAT), chunk('IEND', IEND)]);
}

function createIHDR(w: number, h: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.writeUInt32BE(w, 0);
  buf.writeUInt32BE(h, 4);
  buf[8] = 8; buf[9] = 2; buf[10] = 0; buf[11] = 0; buf[12] = 0;
  return buf;
}

function createIDAT(w: number, h: number, r: number, g: number, b: number): Buffer {
  const raw: number[] = [];
  for (let y = 0; y < h; y++) {
    raw.push(0);
    for (let x = 0; x < w; x++) {
      const cx = x / w;
      const cy = y / h;
      const centerX = Math.abs(cx - 0.5) * 2;
      const centerY = Math.abs(cy - 0.5) * 2;
      const dist = Math.sqrt(centerX * centerX + centerY * centerY);

      let pr = 255, pg = 255, pb = 255;
      if (dist > 0.55) {
        pr = r; pg = g; pb = b;
      } else if (dist > 0.35) {
        const t = (dist - 0.35) / 0.2;
        pr = Math.round(r + (255 - r) * (1 - t));
        pg = Math.round(g + (255 - g) * (1 - t));
        pb = Math.round(b + (255 - b) * (1 - t));
      }
      raw.push(pr, pg, pb, 255);
    }
  }
  return deflateSync(Buffer.from(raw));
}

function createIEND(): Buffer { return Buffer.alloc(0); }

const sizes = [
  { w: 192, h: 192, out: 'public/icons/icon-192x192.png' },
  { w: 512, h: 512, out: 'public/icons/icon-512x512.png' },
  { w: 180, h: 180, out: 'public/icons/apple-touch-icon.png' },
];

for (const size of sizes) {
  const png = createPNG(size.w, size.h, 79, 70, 229);
  writeFileSync(size.out, png);
  console.log(`Created ${size.out} (${size.w}x${size.h}, ${png.length} bytes)`);
}
