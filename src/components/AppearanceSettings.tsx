import { useState } from 'react';
import { ThemeId, THEMES, getStoredTheme, storeTheme, applyTheme } from '../lib/theme';
import { Palette } from 'lucide-react';

export default function AppearanceSettings() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() => getStoredTheme());
  const [expanded, setExpanded] = useState(false);

  const handleChange = (theme: ThemeId) => {
    setActiveTheme(theme);
    storeTheme(theme);
    applyTheme(theme);
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-premium">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 rounded-xl border border-violet-100/50 group-hover:scale-105 transition-transform duration-200">
            <Palette className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800">Appearance</h3>
            <p className="text-[10.5px] text-slate-400">{THEMES[activeTheme].label} theme</p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 animate-fade-in-up">
          {(Object.entries(THEMES) as [ThemeId, typeof THEMES[ThemeId]][]).map(([id, def]) => (
            <button
              key={id}
              type="button"
              onClick={() => handleChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${activeTheme === id ? 'bg-slate-100 text-slate-900 ring-2 ring-offset-1 ring-slate-300' : 'text-slate-600 hover:bg-slate-50'}`}
              aria-label={`${def.label} theme`}
              aria-pressed={activeTheme === id}
            >
              <span
                className="w-5 h-5 rounded-full border border-black/10 shrink-0"
                style={{ backgroundColor: def.colours.primary }}
              />
              {def.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
