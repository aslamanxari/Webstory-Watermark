'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Image as ImageIcon, X, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';

// Configure pdf.js worker globally on the client side
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// Helper to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

interface PDFUploadProps {
  pdfFile: File | null;
  setPdfFile: (file: File | null) => void;
  pdfPages: number;
  setPdfPages: (pages: number) => void;
}

export function PDFUploadCard({
  pdfFile,
  setPdfFile,
  pdfPages,
  setPdfPages,
}: PDFUploadProps) {
  const [loading, setLoading] = useState(false);

  const onPdfDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are accepted.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('PDF exceeds 100MB size limit.');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Reading PDF metadata...');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });
      const pdf = await loadingTask.promise;
      
      setPdfFile(file);
      setPdfPages(pdf.numPages);
      toast.success(`Successfully loaded PDF: ${pdf.numPages} page(s)`, { id: loadingToast });
    } catch (error: any) {
      console.error('PDF Load Error:', error);
      toast.error('Failed to parse PDF file. It might be corrupted or password-protected.', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  }, [setPdfFile, setPdfPages]);

  const removePdf = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPdfFile(null);
    setPdfPages(0);
    toast.success('PDF removed');
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop: onPdfDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    disabled: loading,
  });

  return (
    <AnimatePresence mode="wait">
      {!pdfFile ? (
        <motion.div
          key="pdf-upload"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          {...(getRootProps() as any)}
          className={`relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[180px] bg-slate-900/10 dark:bg-slate-950/20
            ${isDragActive 
              ? 'border-blue-500 bg-blue-500/5' 
              : 'border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/10'
            }`}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/10">
            <UploadCloud className="w-6 h-6 text-blue-500 animate-pulse" />
          </div>
          <h3 className="text-base font-bold text-slate-100">
            Drag & Drop PDF here
          </h3>
          <p className="text-xs text-slate-500 mt-2 max-w-sm">
            Upload high-resolution documents. PDF pages will be processed automatically to 4:5 aspect ratio.
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="pdf-selected"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="relative p-5 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md shadow-sm flex items-center justify-between"
        >
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-500 flex items-center justify-center flex-shrink-0 border border-blue-500/10">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold text-slate-100 truncate">
                {pdfFile.name}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                <span>{formatBytes(pdfFile.size)}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                <span>{pdfPages} Pages</span>
              </div>
            </div>
          </div>

          <button
            onClick={removePdf}
            className="p-2 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-rose-500 transition-colors"
            title="Remove file"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface WatermarkUploadProps {
  watermarkFile: File | null;
  setWatermarkFile: (file: File | null) => void;
  watermarkUrl: string | null;
  setWatermarkUrl: (url: string | null) => void;
}

export function WatermarkUploadCard({
  watermarkFile,
  setWatermarkFile,
  watermarkUrl,
  setWatermarkUrl,
}: WatermarkUploadProps) {
  const [loading, setLoading] = useState(false);

  const onWatermarkDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (file.type !== 'image/png' && file.type !== 'image/webp') {
      toast.error('Only transparent PNG or WEBP watermarks are supported.');
      return;
    }

    setLoading(true);
    try {
      const url = URL.createObjectURL(file);
      setWatermarkFile(file);
      setWatermarkUrl(url);
      toast.success('Watermark preview loaded!');
    } catch (error) {
      toast.error('Failed to read watermark image.');
    } finally {
      setLoading(false);
    }
  }, [setWatermarkFile, setWatermarkUrl]);

  const removeWatermark = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (watermarkUrl) {
      URL.revokeObjectURL(watermarkUrl);
    }
    setWatermarkFile(null);
    setWatermarkUrl(null);
    toast.success('Watermark removed');
  };

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop: onWatermarkDrop,
    accept: { 'image/png': ['.png'], 'image/webp': ['.webp'] },
    multiple: false,
    disabled: loading,
  });

  return (
    <div className="w-full">
      
      <AnimatePresence mode="wait">
        {!watermarkFile ? (
          <motion.div
            key="wm-upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            {...(getRootProps() as any)}
            className={`relative border-2 border-dashed rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 w-48 mx-auto aspect-[4/5] bg-slate-900/10 dark:bg-slate-950/20
              ${isDragActive 
                ? 'border-blue-500 bg-blue-500/5' 
                : 'border-slate-800 hover:border-blue-500/60 hover:bg-slate-900/10'
              }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="w-8 h-8 text-slate-500 mb-3" />
            <h4 className="text-xs font-bold text-slate-400 leading-normal max-w-[150px]">
              Upload WebStory (4:5) Frame (.PNG / .WEBP)
            </h4>
          </motion.div>
        ) : (
          <motion.div
            key="wm-selected"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="relative w-48 mx-auto aspect-[4/5] rounded-3xl bg-slate-900/40 border-2 border-dashed border-slate-800 backdrop-blur-md shadow-sm overflow-hidden flex flex-col justify-between"
          >
            {/* Checkerboard area for preview */}
            <div className="relative flex-1 w-full flex items-center justify-center p-4 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={watermarkUrl || ''}
                alt="Watermark preview"
                className="max-w-full max-h-full object-contain"
              />
              
              {/* Delete button absolute in top-right */}
              <button
                onClick={removeWatermark}
                className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-slate-950/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-450 border border-slate-800 transition-colors shadow-lg"
                title="Remove watermark"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
