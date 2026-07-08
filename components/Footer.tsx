'use client';

import { ShieldCheck, Cpu } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-white/40 dark:bg-[#0f172a]/40 border-t border-slate-200/50 dark:border-slate-800/50 py-6 mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span>&copy; 2026 NetGram IT Solution.</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Files never stored on server</span>
          </div>
          <div className="flex items-center gap-1">
            <Cpu className="w-4 h-4 text-indigo-500" />
            <span>Accelerated browser engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
