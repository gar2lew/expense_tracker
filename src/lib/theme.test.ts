import { describe, it, expect, beforeEach } from 'vitest';
import { getStoredTheme, storeTheme, applyTheme, THEMES } from './theme';

describe('Theme system', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.removeProperty('--theme-primary');
    document.documentElement.style.removeProperty('--theme-primary-hover');
    document.documentElement.style.removeProperty('--theme-primary-light');
    document.documentElement.style.removeProperty('--theme-primary-bg');
  });

  it('getStoredTheme returns indigo by default when nothing stored', () => {
    expect(getStoredTheme()).toBe('indigo');
  });

  it('getStoredTheme returns stored theme', () => {
    localStorage.setItem('gaz-theme', 'emerald');
    expect(getStoredTheme()).toBe('emerald');
  });

  it('getStoredTheme falls back to indigo for invalid stored value', () => {
    localStorage.setItem('gaz-theme', 'pink');
    expect(getStoredTheme()).toBe('indigo');
  });

  it('getStoredTheme falls back to indigo for missing key', () => {
    localStorage.setItem('gaz-theme', '');
    expect(getStoredTheme()).toBe('indigo');
  });

  it('storeTheme persists the theme', () => {
    storeTheme('navy');
    expect(localStorage.getItem('gaz-theme')).toBe('navy');
  });

  it('applyTheme sets data-theme attribute', () => {
    applyTheme('amber');
    expect(document.documentElement.getAttribute('data-theme')).toBe('amber');
  });

  it('applyTheme sets CSS custom properties', () => {
    applyTheme('emerald');
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--theme-primary')).toBe(THEMES.emerald.colours.primary);
    expect(style.getPropertyValue('--theme-primary-hover')).toBe(THEMES.emerald.colours.primaryHover);
  });

  it('immediate theme switching updates properties', () => {
    applyTheme('indigo');
    applyTheme('navy');
    expect(document.documentElement.getAttribute('data-theme')).toBe('navy');
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe(THEMES.navy.colours.primary);
  });

  it('all themes have required colour properties', () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.colours.primary).toBeTruthy();
      expect(theme.colours.primaryHover).toBeTruthy();
      expect(theme.colours.primaryLight).toBeTruthy();
      expect(theme.colours.primaryBg).toBeTruthy();
      expect(theme.label).toBeTruthy();
    }
  });

  it('five themes are defined', () => {
    const ids = Object.keys(THEMES);
    expect(ids).toHaveLength(5);
    expect(ids).toContain('indigo');
    expect(ids).toContain('navy');
    expect(ids).toContain('emerald');
    expect(ids).toContain('amber');
    expect(ids).toContain('slate');
  });
});
