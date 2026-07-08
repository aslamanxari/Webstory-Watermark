'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Move,
  Contrast
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
import toast from 'react-hot-toast';

interface PreviewProps {
  pdfFile: File | null;
  pdfPages: number;
  watermarkUrl: string | null;
  settings: {
    quality: number;
    resolution: 'low' | 'medium' | 'high' | 'ultra';
    background: 'white' | 'transparent';
  };
  invertedPages: Record<number, boolean>;
  onToggleInvert: (pageNum: number) => void;
}

export default function Preview({
  pdfFile,
  pdfPages,
  watermarkUrl,
  settings,
  invertedPages,
  onToggleInvert,
}: PreviewProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('after');
  const [zoom, setZoom] = useState<number>(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const beforeCanvasRef = useRef<HTMLCanvasElement>(null);
  const afterCanvasRef = useRef<HTMLCanvasElement>(null);
  const watermarkImageRef = useRef<HTMLImageElement | null>(null);

  // Track active PDF.js render task to allow cancellation
  const activeRenderTaskRef = useRef<any>(null);

  // Track page transitions and reset zoom/pan
  useEffect(() => {
    setPan({ x: 0, y: 0 });
  }, [currentPage]);

  // Load watermark image asset
  useEffect(() => {
    if (!watermarkUrl) {
      watermarkImageRef.current = null;
      return;
    }
    const img = new Image();
    img.src = watermarkUrl;
    img.onload = () => {
      watermarkImageRef.current = img;
      renderPreview();
    };
  }, [watermarkUrl]);

  // Trigger render when files, page, settings, watermark, or inversion state change
  useEffect(() => {
    if (pdfFile) {
      renderPreview();
    }
  }, [pdfFile, currentPage, settings, watermarkUrl, invertedPages]);

  const renderPreview = async () => {
    if (!pdfFile) return;
    setLoading(true);

    // Cancel the previous render task if it is still executing
    if (activeRenderTaskRef.current) {
      try {
        activeRenderTaskRef.current.cancel();
      } catch (err) {
        // ignore
      }
      activeRenderTaskRef.current = null;
    }

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      // Render PDF page
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(currentPage);

      // Render original page at scale = 1.5 for high-fidelity preview
      const viewport = page.getViewport({ scale: 1.5 });

      const beforeCanvas = beforeCanvasRef.current;
      const afterCanvas = afterCanvasRef.current;

      if (!beforeCanvas || !afterCanvas) return;

      // 1. Draw "Before" Canvas (Original PDF Page)
      beforeCanvas.width = viewport.width;
      beforeCanvas.height = viewport.height;
      const beforeCtx = beforeCanvas.getContext('2d');
      if (beforeCtx) {
        const renderTask = page.render({
          canvasContext: beforeCtx,
          viewport,
          canvas: beforeCanvas
        });
        activeRenderTaskRef.current = renderTask;

        try {
          await renderTask.promise;
        } catch (err: any) {
          if (err.name === 'RenderingCancelledException' || err.message?.includes('cancelled')) {
            // Render was cancelled by a newer trigger. Silent return.
            return;
          }
          throw err;
        } finally {
          if (activeRenderTaskRef.current === renderTask) {
            activeRenderTaskRef.current = null;
          }
        }
      }

      // 2. Draw "After" Canvas (Watermarked + 4:5 aspect ratio)
      const afterCtx = afterCanvas.getContext('2d');
      if (!afterCtx) return;

      // Fix resolution for the preview canvas at 800 x 1000 (standard 4:5 ratio)
      afterCanvas.width = 800;
      afterCanvas.height = 1000;

      // Fill background
      afterCtx.clearRect(0, 0, 800, 1000);
      if (settings.background === 'white') {
        afterCtx.fillStyle = '#ffffff';
        afterCtx.fillRect(0, 0, 800, 1000);
      } else {
        // Transparent representation
        afterCtx.fillStyle = 'rgba(0,0,0,0)';
        afterCtx.fillRect(0, 0, 800, 1000);
      }

      // Fit the original rendered PDF page (from beforeCanvas) into the 800 x 1000 canvas
      const scale = Math.min(800 / beforeCanvas.width, 1000 / beforeCanvas.height);
      const wRender = beforeCanvas.width * scale;
      const hRender = beforeCanvas.height * scale;
      const xOffset = (800 - wRender) / 2;
      const yOffset = (1000 - hRender) / 2;

      afterCtx.drawImage(beforeCanvas, xOffset, yOffset, wRender, hRender);

      // 3. Draw Watermark directly covering 100% of the canvas boundaries
      const wmImg = watermarkImageRef.current;
      if (wmImg && wmImg.naturalWidth > 0) {
        const isInverted = invertedPages[currentPage];
        afterCtx.save();
        if (isInverted) {
          afterCtx.filter = 'invert(1)';
        }
        afterCtx.drawImage(wmImg, 0, 0, 800, 1000);
        afterCtx.restore();
      } else if (watermarkUrl) {
        toast.error('Watermark asset failed to load in preview.');
      }
    } catch (e: any) {
      console.error('Error drawing preview:', e);
      toast.error('Error rendering page preview.');
    } finally {
      setLoading(false);
    }
  };

  // Zoom & Pan Handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 25));
  const handleZoomReset = () => {
    setZoom(100);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const nextPage = () => {
    if (currentPage < pdfPages) setCurrentPage(currentPage + 1);
  };

  return (
    <div className="flex flex-col h-full bg-slate-100/50 dark:bg-slate-900/40 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 overflow-hidden shadow-inner">

      {/* PREVIEW HEADER */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-md">

        {/* Toggle tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl">
          <button
            onClick={() => setActiveTab('before')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300
              ${activeTab === 'before'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Before (Original)</span>
          </button>
          <button
            onClick={() => setActiveTab('after')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-300
              ${activeTab === 'after'
                ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>After (Watermarked)</span>
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-all"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className="px-2.5 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-all"
            title="Reset Zoom"
          >
            {zoom}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition-all"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PREVIEW CONTAINER */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 flex items-center justify-center p-6 overflow-hidden relative select-none cursor-grab active:cursor-grabbing min-h-[400px]"
      >
        {loading && (
          <div className="absolute inset-0 bg-slate-900/10 dark:bg-slate-950/20 backdrop-blur-xs flex items-center justify-center z-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-xs font-semibold text-indigo-500">Updating Live Preview...</span>
            </div>
          </div>
        )}

        {!pdfFile && (
          <div className="flex flex-col items-center justify-center text-center max-w-xs text-slate-400 dark:text-slate-500 gap-3">
            <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700">
              <Move className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium">
              Upload a PDF to render real-time interactive preview
            </p>
          </div>
        )}

        {/* Canvases wrapper */}
        {pdfFile && (
          <div
            style={{
              transform: `scale(${zoom / 100}) translate(${pan.x}px, ${pan.y}px)`,
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            className="relative flex items-center justify-center max-w-full max-h-full shadow-lg rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800"
          >
            {/* Before Canvas (Hidden unless active) */}
            <canvas
              ref={beforeCanvasRef}
              className={`bg-white shadow-md ${activeTab === 'before' ? 'block' : 'hidden'}`}
              style={{ maxHeight: '70vh', width: 'auto', objectFit: 'contain' }}
            />

            {/* After Canvas (Hidden unless active) */}
            <div className={`relative ${activeTab === 'after' ? 'block' : 'hidden'} checkerboard-bg shadow-md`}>
              <canvas
                ref={afterCanvasRef}
                style={{ maxHeight: '70vh', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* PREVIEW NAVIGATION FOOTER */}
      {pdfFile && (
        <div className="px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-md">
          <div className="flex items-center gap-1">
            <button
              onClick={prevPage}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 flex-shrink-0">
              Page {currentPage} of {pdfPages}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage >= pdfPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {watermarkUrl && activeTab === 'after' && (
            <button
              onClick={() => onToggleInvert(currentPage)}
              className={`flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold rounded-xl border transition-all duration-300 shadow-sm
                ${invertedPages[currentPage]
                  ? 'bg-blue-600 hover:bg-blue-700 border-blue-600 text-white shadow-blue-600/20'
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
            >
              <Contrast className="w-3.5 h-3.5" />
              <span>{invertedPages[currentPage] ? 'Watermark: Inverted' : 'Invert Watermark'}</span>
            </button>
          )}

          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-right">
            Drag canvas to pan • Pinch / zoom
          </div>
        </div>
      )}
    </div>
  );
}
