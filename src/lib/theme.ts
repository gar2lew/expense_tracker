export type ThemeId = 'indigo' | 'navy' | 'emerald' | 'amber' | 'slate';

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  colours: {
    primary: string;
    primaryHover: string;
    primaryLight: string;
    primaryBg: string;
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  indigo: {
    id: 'indigo',
    label: 'Indigo',
    colours: { primary: '#4f46e5', primaryHover: '#4338ca', primaryLight: '#6366f1', primaryBg: '#eef2ff' },
  },
  navy: {
    id: 'navy',
    label: 'Navy',
    colours: { primary: '#1e40af', primaryHover: '#1e3a8a', primaryLight: '#3b82f6', primaryBg: '#eff6ff' },
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald',
    colours: { primary: '#059669', primaryHover: '#047857', primaryLight: '#10b981', primaryBg: '#ecfdf5' },
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    colours: { primary: '#d97706', primaryHover: '#b45309', primaryLight: '#f59e0b', primaryBg: '#fffbeb' },
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    colours: { primary: '#475569', primaryHover: '#334155', primaryLight: '#64748b', primaryBg: '#f1f5f9' },
  },
};

const STORAGE_KEY = 'gaz-theme';

export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored in THEMES) return stored as ThemeId;
  } catch { /* localStorage unavailable */ }
  return 'indigo';
}

export function storeTheme(theme: ThemeId): void {
  try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* unavailable */ }
}

export function applyTheme(theme: ThemeId): void {
  const def = THEMES[theme];
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.style.setProperty('--theme-primary', def.colours.primary);
  root.style.setProperty('--theme-primary-hover', def.colours.primaryHover);
  root.style.setProperty('--theme-primary-light', def.colours.primaryLight);
  root.style.setProperty('--theme-primary-bg', def.colours.primaryBg);
}
