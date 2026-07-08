'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProgressBar from '@/components/ProgressBar';

const PDFUploadCard = dynamic(
  () => import('@/components/UploadCard').then((m) => m.PDFUploadCard),
  { ssr: false }
);
const WatermarkUploadCard = dynamic(
  () => import('@/components/UploadCard').then((m) => m.WatermarkUploadCard),
  { ssr: false }
);
const Preview = dynamic(() => import('@/components/Preview'), { ssr: false });

import JSZip from 'jszip';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  Play,
  Download,
  RefreshCw,
  DownloadCloud,
  FileImage,
  Image as ImageIcon,
  Sliders
} from 'lucide-react';

export interface WatermarkSettings {
  quality: number;       // 1 - 100
  resolution: 'low' | 'medium' | 'high' | 'ultra';
  background: 'white' | 'transparent';
}

// Define initial settings (low resolution, transparent-first)
const INITIAL_SETTINGS: WatermarkSettings = {
  quality: 80,
  resolution: 'low',
  background: 'transparent',
};

interface ConvertedPage {
  pageNum: number;
  url: string;
  blob: Blob;
}

export default function Home() {
  // File states
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPages, setPdfPages] = useState<number>(0);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);

  // Settings
  const [settings, setSettings] = useState<WatermarkSettings>(INITIAL_SETTINGS);

  // Conversion States
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentConvertPage, setCurrentConvertPage] = useState<number>(0);
  const [convertStartTime, setConvertStartTime] = useState<number | null>(null);
  const [statusText, setStatusText] = useState<string>('');

  // Output States
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [convertedPages, setConvertedPages] = useState<ConvertedPage[]>([]);

  // Per-page Watermark Alter (Invert) State
  const [invertedPages, setInvertedPages] = useState<Record<number, boolean>>({});

  const toggleInvertPage = (pageNum: number) => {
    setInvertedPages((prev) => ({
      ...prev,
      [pageNum]: !prev[pageNum],
    }));
  };

  // Store refs of dynamic object URLs to ensure clean up ONLY on unmount
  const watermarkUrlRef = useRef<string | null>(null);
  const zipUrlRef = useRef<string | null>(null);
  const convertedPagesRef = useRef<ConvertedPage[]>([]);

  useEffect(() => {
    watermarkUrlRef.current = watermarkUrl;
  }, [watermarkUrl]);

  useEffect(() => {
    zipUrlRef.current = zipUrl;
  }, [zipUrl]);

  useEffect(() => {
    convertedPagesRef.current = convertedPages;
  }, [convertedPages]);

  useEffect(() => {
    return () => {
      if (watermarkUrlRef.current) URL.revokeObjectURL(watermarkUrlRef.current);
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
      convertedPagesRef.current.forEach((page) => URL.revokeObjectURL(page.url));
    };
  }, []);

  const resetAll = () => {
    if (watermarkUrl) URL.revokeObjectURL(watermarkUrl);
    if (zipUrl) URL.revokeObjectURL(zipUrl);
    convertedPages.forEach((page) => URL.revokeObjectURL(page.url));

    setPdfFile(null);
    setPdfPages(0);
    setWatermarkFile(null);
    setWatermarkUrl(null);
    setSettings(INITIAL_SETTINGS);
    setInvertedPages({});
    setIsConverting(false);
    setProgress(0);
    setCurrentConvertPage(0);
    setConvertStartTime(null);
    setStatusText('');
    setZipUrl(null);
    setConvertedPages([]);
    toast.success('App settings reset successfully');
  };

  // Main Conversion Logic
  const handleConvert = async () => {
    if (!pdfFile || !watermarkUrl || !watermarkFile) {
      toast.error('Please upload both PDF and Watermark image before converting.');
      return;
    }

    setIsConverting(true);
    setProgress(0);
    setCurrentConvertPage(0);
    setConvertStartTime(Date.now());
    setStatusText('Preparing documents...');
    setZipUrl(null);

    // Revoke old page URLs if any
    convertedPages.forEach((page) => URL.revokeObjectURL(page.url));
    setConvertedPages([]);

    const loadingToast = toast.loading('Starting PDF rendering...');

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const pdf = await pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;

      // Load Watermark Image
      const wmImg = new Image();
      wmImg.src = watermarkUrl;
      await new Promise<void>((resolve, reject) => {
        wmImg.onload = () => resolve();
        wmImg.onerror = () => reject(new Error('Failed to load watermark image'));
      });

      const zip = new JSZip();
      const results: ConvertedPage[] = [];

      // Determine dimensions based on resolution settings (4:5 Aspect Ratio)
      let targetWidth = 1200;
      let targetHeight = 1500;
      switch (settings.resolution) {
        case 'low':
          targetWidth = 800;
          targetHeight = 1000;
          break;
        case 'medium':
          targetWidth = 1200;
          targetHeight = 1500;
          break;
        case 'high':
          targetWidth = 1600;
          targetHeight = 2000;
          break;
        case 'ultra':
          targetWidth = 2400;
          targetHeight = 3000;
          break;
      }

      toast.loading('Processing pages (0%)...', { id: loadingToast });

      for (let i = 1; i <= pdf.numPages; i++) {
        setCurrentConvertPage(i);
        const percent = ((i - 1) / pdf.numPages) * 100;
        setProgress(percent);
        setStatusText(`Rendering page ${i} of ${pdf.numPages}...`);

        // Render PDF page to canvas
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = viewport.width;
        pageCanvas.height = viewport.height;
        const pageCtx = pageCanvas.getContext('2d');
        if (!pageCtx) throw new Error('Could not create canvas 2d context');

        await page.render({
          canvasContext: pageCtx,
          viewport,
          canvas: pageCanvas
        }).promise;

        // Draw 4:5 aspect ratio fitted page
        const targetCanvas = document.createElement('canvas');
        targetCanvas.width = targetWidth;
        targetCanvas.height = targetHeight;
        const targetCtx = targetCanvas.getContext('2d');
        if (!targetCtx) throw new Error('Could not create target canvas context');

        // Fill background
        if (settings.background === 'white') {
          targetCtx.fillStyle = '#ffffff';
          targetCtx.fillRect(0, 0, targetWidth, targetHeight);
        } else {
          targetCtx.clearRect(0, 0, targetWidth, targetHeight);
        }

        // Contain fit calculation
        const scale = Math.min(targetWidth / pageCanvas.width, targetHeight / pageCanvas.height);
        const wRender = pageCanvas.width * scale;
        const hRender = pageCanvas.height * scale;
        const xOffset = (targetWidth - wRender) / 2;
        const yOffset = (targetHeight - hRender) / 2;

        targetCtx.drawImage(pageCanvas, xOffset, yOffset, wRender, hRender);

        // Apply full-bleed watermark
        if (wmImg && wmImg.naturalWidth > 0) {
          const isInverted = invertedPages[i];
          if (isInverted) {
            targetCtx.filter = 'invert(1)';
          }
          targetCtx.drawImage(wmImg, 0, 0, targetWidth, targetHeight);
          if (isInverted) {
            targetCtx.filter = 'none';
          }
        } else {
          throw new Error(`Watermark image failed to render on page ${i}. Please verify the watermark asset.`);
        }

        // Convert page canvas to WebP blob
        const blob = await new Promise<Blob>((res, rej) => {
          targetCanvas.toBlob(
            (b) => {
              if (b) res(b);
              else rej(new Error('Failed to encode canvas as WebP'));
            },
            'image/webp',
            settings.quality / 100
          );
        });

        const pageUrl = URL.createObjectURL(blob);
        results.push({
          pageNum: i,
          url: pageUrl,
          blob: blob,
        });

        // Add file to ZIP
        zip.file(`${i}.webp`, blob);
      }

      // Finalize ZIP
      setProgress(98);
      setStatusText('Assembling ZIP archive...');
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const urlOfZip = URL.createObjectURL(zipBlob);

      setZipUrl(urlOfZip);
      setConvertedPages(results);
      setProgress(100);
      setStatusText('Successfully processed all pages!');

      toast.success('Conversion complete! ZIP generated.', { id: loadingToast });

      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

    } catch (error: any) {
      console.error('Conversion Failed:', error);
      toast.error(`Conversion failed: ${error.message || 'Unknown error occurred'}`, { id: loadingToast });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownloadPage = (page: ConvertedPage) => {
    const link = document.createElement('a');
    link.href = page.url;
    link.download = `${page.pageNum}.webp`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isConvertReady = pdfFile && watermarkFile;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">

        {/* DASHBOARD CONTAINER GRID (8/12 - 4/12 split layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: UPLOAD SOURCE & BEFORE/AFTER LIVE PREVIEW (8/12 width) */}
          <div className="lg:col-span-8 space-y-6">

            {/* 1. Main PDF Upload Card */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-md">
              <PDFUploadCard
                pdfFile={pdfFile}
                setPdfFile={setPdfFile}
                pdfPages={pdfPages}
                setPdfPages={setPdfPages}
              />
            </div>

            {/* 2. Before / After Live Preview (Moved to the wide panel for high-fidelity comparisons) */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl overflow-hidden shadow-sm backdrop-blur-md">
              <Preview
                pdfFile={pdfFile}
                pdfPages={pdfPages}
                watermarkUrl={watermarkUrl}
                settings={settings}
                invertedPages={invertedPages}
                onToggleInvert={toggleInvertPage}
              />
            </div>

          </div>

          {/* RIGHT COLUMN: WATERMARK CONFIG, SETTINGS & DOWNLOADS (4/12 width) */}
          <div className="lg:col-span-4 space-y-6">

            {/* 1. Watermark Config Card */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-md">
              <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                <ImageIcon className="w-4.5 h-4.5 text-blue-500" />
                Watermark Config
              </h2>
              <WatermarkUploadCard
                watermarkFile={watermarkFile}
                setWatermarkFile={setWatermarkFile}
                watermarkUrl={watermarkUrl}
                setWatermarkUrl={setWatermarkUrl}
              />
            </div>

            {/* 2. Output Settings Card */}
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-md">
              <h2 className="text-base font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Sliders className="w-4.5 h-4.5 text-blue-500" />
                Output Settings
              </h2>

              <div className="space-y-4">
                {/* Resolution */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">
                    Output Resolution (4:5 Ratio)
                  </label>
                  <select
                    value={settings.resolution}
                    onChange={(e: any) => setSettings((s) => ({ ...s, resolution: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200"
                  >
                    <option value="low">Low (800 x 1000px)</option>
                    <option value="medium">Medium (1200 x 1500px)</option>
                    <option value="high">High (1600 x 2000px)</option>
                    <option value="ultra">Ultra HD (2400 x 3000px)</option>
                  </select>
                </div>

                {/* Background color */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-400">
                    Canvas Background Color
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, background: 'white' }))}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-300 shadow-sm
                        ${settings.background === 'white'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-blue-600/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900/60'
                        }`}
                    >
                      Solid White
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings((s) => ({ ...s, background: 'transparent' }))}
                      className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-300 shadow-sm
                        ${settings.background === 'transparent'
                          ? 'bg-blue-600 border-blue-600 text-white shadow-blue-600/10'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900/60'
                        }`}
                    >
                      Transparent
                    </button>
                  </div>
                </div>

                {/* Quality */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>WebP Compression Quality</span>
                    <span className="text-blue-500">{settings.quality}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={settings.quality}
                    onChange={(e) => setSettings((s) => ({ ...s, quality: parseInt(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 3. Converted Pages / Individual Downloads (Compact list in sidebar) */}
            {convertedPages.length > 0 && (
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-5 shadow-sm backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <FileImage className="w-4 h-4 text-blue-500" />
                    <span>Individual Downloads</span>
                  </h3>
                  <span className="px-2 py-0.2 text-[10px] font-bold bg-slate-800 text-slate-400 rounded border border-slate-700/50">
                    {convertedPages.length} Pages
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {convertedPages.map((page) => (
                    <div
                      key={page.pageNum}
                      onClick={() => handleDownloadPage(page)}
                      className="group relative p-2 bg-slate-950 border border-slate-800/60 rounded-xl flex items-center justify-between hover:border-blue-500/40 transition-all duration-300 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded bg-blue-600/10 text-blue-500 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-blue-500/10">
                          P{page.pageNum}
                        </div>
                        <span className="text-[10px] font-bold text-slate-300 truncate">Page {page.pageNum}</span>
                      </div>
                      <div className="w-5 h-5 rounded bg-slate-900 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <DownloadCloud className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* BOTTOM PANEL: ACTION CONTROLS */}
        <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 shadow-sm backdrop-blur-md transition-all duration-300">

          {/* Active conversion state */}
          {isConverting && (
            <div className="mb-6 animate-pulse">
              <ProgressBar
                progress={progress}
                currentPage={currentConvertPage}
                totalPages={pdfPages}
                startTime={convertStartTime}
                statusText={statusText}
              />
            </div>
          )}

          {/* Button groups */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">

            {/* Left reset option */}
            <div>
              {(pdfFile || watermarkFile) && (
                <button
                  onClick={resetAll}
                  disabled={isConverting}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-all duration-300 disabled:opacity-40"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset All Settings</span>
                </button>
              )}
            </div>

            {/* Right main action button */}
            <div className="flex items-center gap-3 w-full sm:w-auto font-sans">

              {/* ZIP download button if generated */}
              {zipUrl && (
                <a
                  href={zipUrl}
                  download="watermarked-images.zip"
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-600/10 hover:scale-102 transition-all duration-300 animate-bounce"
                >
                  <Download className="w-4.5 h-4.5" />
                  <span>Download ZIP Archive</span>
                </a>
              )}

              {/* Start conversion button */}
              <button
                onClick={handleConvert}
                disabled={!isConvertReady || isConverting}
                className={`flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3.5 font-bold text-sm rounded-2xl shadow-lg transition-all duration-300 hover:scale-101
                  ${isConvertReady && !isConverting
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed shadow-none'
                  }`}
              >
                <Play className="w-4.5 h-4.5" />
                <span>{isConverting ? 'Processing Pages...' : 'Convert PDF Pages'}</span>
              </button>

            </div>

          </div>

        </div>

      </main>

      <Footer />
    </div>
  );
}
