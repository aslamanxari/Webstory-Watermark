'use client';

import { useTheme } from './ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 backdrop-blur-md text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/80 transition-all duration-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
      aria-label="Toggle theme"
      id="theme-switcher-btn"
    >
      {theme === 'light' ? <Moon className="w-5 h-5 animate-pulse" /> : <Sun className="w-5 h-5 text-amber-400 animate-spin-slow" />}
    </button>
  );
}
