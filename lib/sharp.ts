import sharp, { OverlayOptions } from 'sharp';

export interface WatermarkSettings {
  quality: number;       // 1 - 100
  resolution: 'low' | 'medium' | 'high' | 'ultra';
  background: 'white' | 'transparent';
}

/**
 * Applies a full-bleed watermark to a page image and outputs a WebP image using Sharp.
 */
export async function applyWatermark(
  pagePngBuffer: Buffer,
  watermarkBuffer: Buffer,
  settings: WatermarkSettings
): Promise<Buffer> {
  // 1. Determine target canvas dimensions based on resolution setting (4:5 aspect ratio)
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

  // 2. Set background color (white or transparent)
  const isTransparent = settings.background === 'transparent';
  const bgObj = { r: 255, g: 255, b: 255, alpha: isTransparent ? 0 : 1 };

  // 3. Process the watermark to fit the canvas boundary exactly (100% width, 100% height)
  const finalWatermarkBuffer = await sharp(watermarkBuffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .toBuffer();

  // 4. Composite option to overlay watermark from top-left (0, 0)
  const compositeOptions: OverlayOptions[] = [
    {
      input: finalWatermarkBuffer,
      left: 0,
      top: 0,
      blend: 'over',
    }
  ];

  // Fit original PDF page inside the 4:5 aspect ratio canvas, and overlay the watermark template
  return sharp(pagePngBuffer)
    .resize({
      width: targetWidth,
      height: targetHeight,
      fit: 'contain',
      background: bgObj,
    })
    .composite(compositeOptions)
    .webp({ quality: settings.quality })
    .toBuffer();
}
