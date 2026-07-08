import path from 'path';

/**
 * Returns the total number of pages in a PDF document using pdf-lib.
 * This is very fast and does not require rendering.
 */
export async function getPageCount(pdfBuffer: Buffer): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
  return pdfDoc.getPageCount();
}

/**
 * Renders a specific page of a PDF document to a PNG Buffer using pdfjs-dist and canvas.
 */
export async function renderPageToPng(
  pdfBuffer: Buffer,
  pageNum: number,
  scale: number = 2.0
): Promise<Buffer> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  // @ts-ignore
  await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  const { createCanvas } = await import('canvas');

  // Configure standard font path to avoid missing standard font warnings.
  // We use unpkg CDN for standard fonts which is reliable and works out of the box.
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.4.168/standard_fonts/',
  });

  const doc = await loadingTask.promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  const renderContext: any = {
    canvasContext: context,
    viewport: viewport,
  };

  await page.render(renderContext).promise;
  return canvas.toBuffer('image/png');
}
