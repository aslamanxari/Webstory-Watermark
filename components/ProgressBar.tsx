'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Hourglass, CheckCircle2, Clock } from 'lucide-react';

interface ProgressBarProps {
  progress: number; // 0 to 100
  currentPage: number;
  totalPages: number;
  startTime: number | null;
  statusText: string;
}

export default function ProgressBar({
  progress,
  currentPage,
  totalPages,
  startTime,
  statusText,
}: ProgressBarProps) {
  const [eta, setEta] = useState<string>('Calculating...');

  useEffect(() => {
    if (!startTime || currentPage === 0 || progress === 0) {
      setEta('Calculating...');
      return;
    }

    const elapsed = Date.now() - startTime; // milliseconds elapsed
    const avgTimePerPage = elapsed / currentPage; // milliseconds per page
    const pagesLeft = totalPages - currentPage;
    const etaMs = avgTimePerPage * pagesLeft;

    if (etaMs <= 0) {
      setEta('Almost done...');
      return;
    }

    const etaSeconds = Math.ceil(etaMs / 1000);
    if (etaSeconds < 60) {
      setEta(`${etaSeconds}s remaining`);
    } else {
      const minutes = Math.floor(etaSeconds / 60);
      const seconds = etaSeconds % 60;
      setEta(`${minutes}m ${seconds}s remaining`);
    }
  }, [progress, currentPage, totalPages, startTime]);

  const isCompleted = progress === 100;

  return (
    <div className="w-full bg-white dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm space-y-4 backdrop-blur-md transition-all duration-300">
      
      {/* STATUS HEADER */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-medium">
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 animate-bounce" />
          ) : (
            <Hourglass className="w-4 h-4 text-indigo-500 animate-spin" />
          )}
          <span>{statusText}</span>
        </div>
        
        {/* Estimated Time Remaining */}
        {!isCompleted && startTime && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-semibold">{eta}</span>
          </div>
        )}
      </div>

      {/* PROGRESS BAR TRACK */}
      <div className="relative w-full h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/20 dark:border-slate-800/20">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
        />
      </div>

      {/* METRICS DETAIL */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <span>
          {!isCompleted && totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : ''}
        </span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
