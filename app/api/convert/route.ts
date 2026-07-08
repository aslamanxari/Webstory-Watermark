import { NextRequest, NextResponse } from 'next/server';
import { getPageCount, renderPageToPng } from '@/lib/pdf';
import { applyWatermark, WatermarkSettings } from '@/lib/sharp';
import JSZip from 'jszip';

export const maxDuration = 300; // Increase Vercel function timeout limit (up to 5 minutes on paid tier, hobby is 60s max)
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // 1. Parse FormData
    const formData = await req.formData();
    const pdfFile = formData.get('pdf') as File | null;
    const watermarkFile = formData.get('watermark') as File | null;
    const settingsJson = formData.get('settings') as string | null;

    // 2. Input Validation
    if (!pdfFile) {
      return NextResponse.json({ error: 'Missing PDF file' }, { status: 400 });
    }
    if (!watermarkFile) {
      return NextResponse.json({ error: 'Missing watermark image file' }, { status: 400 });
    }

    // Validate PDF file size (100MB limit)
    if (pdfFile.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF file exceeds 100MB size limit' }, { status: 400 });
    }

    // Validate file extensions
    if (!pdfFile.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Invalid PDF file format' }, { status: 400 });
    }

    const wmExt = watermarkFile.name.toLowerCase();
    if (!wmExt.endsWith('.png') && !wmExt.endsWith('.webp')) {
      return NextResponse.json({ error: 'Watermark must be in PNG or WEBP format' }, { status: 400 });
    }

    // Parse Settings
    let settings: WatermarkSettings;
    try {
      settings = settingsJson ? JSON.parse(settingsJson) : null;
      if (!settings) throw new Error();
    } catch {
      // Default fallback settings
      settings = {
        quality: 80,
        resolution: 'low',
        background: 'transparent',
      };
    }

    // 3. Read buffers from files
    const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
    const watermarkBuffer = Buffer.from(await watermarkFile.arrayBuffer());

    // 4. Get PDF page count
    const pageCount = await getPageCount(pdfBuffer);
    if (pageCount === 0) {
      return NextResponse.json({ error: 'The PDF has no pages' }, { status: 400 });
    }

    // Ensure we don't crash memory on massive conversions server-side on low-end servers
    if (pageCount > 100) {
      return NextResponse.json({ 
        error: 'Server-side batch conversion is capped at 100 pages to avoid memory overflows. Please use our client-side conversion engine which supports up to 500 pages.' 
      }, { status: 400 });
    }

    // 5. Setup JSZip
    const zip = new JSZip();

    // Map resolutions to render scale factors
    let renderScale = 2.0;
    if (settings.resolution === 'low') renderScale = 1.5;
    if (settings.resolution === 'high') renderScale = 3.0;
    if (settings.resolution === 'ultra') renderScale = 4.0;

    // 6. Process each page sequentially to keep memory usage low
    for (let i = 1; i <= pageCount; i++) {
      // Render PDF page to PNG buffer
      const pagePng = await renderPageToPng(pdfBuffer, i, renderScale);

      // Fit into 4:5 canvas and overlay watermark using sharp
      const webpPage = await applyWatermark(pagePng, watermarkBuffer, settings);

      // Add to ZIP
      zip.file(`${i}.webp`, webpPage);
    }

    // 7. Output ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    // 8. Return response
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="watermarked-images.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('API Convert Route Error:', error);
    return NextResponse.json({ 
      error: `Failed to process document: ${error.message || 'Unknown server error'}` 
    }, { status: 500 });
  }
}
