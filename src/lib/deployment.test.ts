import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

function readBytes(path: string): Buffer {
  return readFileSync(path);
}

function isPNG(buf: Buffer): boolean {
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

describe('PWA icons', () => {
  it('icon-192x192.png has valid PNG signature', () => {
    const buf = readBytes('public/icons/icon-192x192.png');
    expect(isPNG(buf)).toBe(true);
  });

  it('icon-512x512.png has valid PNG signature', () => {
    const buf = readBytes('public/icons/icon-512x512.png');
    expect(isPNG(buf)).toBe(true);
  });

  it('apple-touch-icon.png has valid PNG signature', () => {
    const buf = readBytes('public/icons/apple-touch-icon.png');
    expect(isPNG(buf)).toBe(true);
  });

  it('icon-192x192.png is not an SVG file disguised as PNG', () => {
    const contents = readBytes('public/icons/icon-192x192.png').toString('utf-8').slice(0, 100);
    expect(contents).not.toContain('<svg');
    expect(contents).not.toContain('<?xml');
  });

  it('icon-512x512.png is not an SVG file disguised as PNG', () => {
    const contents = readBytes('public/icons/icon-512x512.png').toString('utf-8').slice(0, 100);
    expect(contents).not.toContain('<svg');
    expect(contents).not.toContain('<?xml');
  });

  it('apple-touch-icon.png is not an SVG file disguised as PNG', () => {
    const contents = readBytes('public/icons/apple-touch-icon.png').toString('utf-8').slice(0, 100);
    expect(contents).not.toContain('<svg');
    expect(contents).not.toContain('<?xml');
  });

  it('manifest references correct icon paths', () => {
    const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf-8'));
    const paths = manifest.icons.map((i: { src: string }) => i.src);
    expect(paths).toContain('/icons/icon-192x192.png');
    expect(paths).toContain('/icons/icon-512x512.png');
    expect(paths).toContain('/icons/apple-touch-icon.png');
  });
});

describe('Analytics removal', () => {
  it('GeminiAnalytics component no longer imported in App.tsx', () => {
    const appContent = readFileSync('src/App.tsx', 'utf-8');
    expect(appContent).not.toContain('GeminiAnalytics');
  });

  it('GeminiAnalytics.tsx file is removed', () => {
    expect(() => readFileSync('src/components/GeminiAnalytics.tsx')).toThrow();
  });

  it('no client code calls /api/analyze-expenses', () => {
    const geminiContent = readFileSync('src/lib/gemini.ts', 'utf-8');
    expect(geminiContent).not.toContain('/api/analyze-expenses');
    expect(geminiContent).not.toContain('analyzeExpenses');
  });
});

describe('Scripts and dependencies', () => {
  it('dev script uses concurrently', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    expect(pkg.scripts.dev).toContain('concurrently');
  });

  it('dotenv is available as dev dependency', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps.dotenv ?? pkg.devDependencies?.dotenv ?? false).toBeTruthy();
  });

  it('receipt parsing client code remains', () => {
    const geminiContent = readFileSync('src/lib/gemini.ts', 'utf-8');
    expect(geminiContent).toContain('parseReceiptImage');
    expect(geminiContent).toContain('/api/parse-receipt');
  });
});
