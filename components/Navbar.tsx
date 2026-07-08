'use client';

import { Layers } from 'lucide-react';

export default function Navbar() {
  return (
    <nav className="w-full sticky top-0 z-50 bg-white/70 dark:bg-[#0f172a]/70 border-b border-slate-200/50 dark:border-slate-800/50 backdrop-blur-lg transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600/20 text-blue-500 border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div className="flex flex-col -space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white">
                  Watermark for<span className="text-blue-500"> WEBSTORY</span>
                </span>
              </div>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                by NETGRAM IT SOLUTIONS
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center text-xs font-bold text-slate-400 bg-slate-900/60 border border-slate-800/60 px-3.5 py-1.5 rounded-xl uppercase tracking-wider">
            only for webstory <span className="text-blue-500 ml-1">4:5</span>
          </div>

          <div className="flex items-center gap-4">
          </div>
        </div>
      </div>
    </nav>
  );
}
