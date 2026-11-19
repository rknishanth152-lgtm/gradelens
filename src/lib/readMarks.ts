/**
 * Turn an uploaded PDF or photo into positioned text, entirely in the browser.
 * PDFs use their text layer (pdf.js). Photos and screenshots go through tesseract.js OCR.
 * The image never leaves the device; the first photo downloads the OCR model (~4 MB) once.
 */
import { FriendlyParseError, isPdfFile, loadPdfItems, type PositionedText } from './pdfParser';
import { cleanForOcr } from './imagePrep';

export type ReadStage = 'opening' | 'loading-model' | 'reading' | 'done';
export interface ReadProgress {
  stage: ReadStage;
  /** 0–1 */
  progress: number;
}

export async function readMarksFile(file: File, onProgress: (p: ReadProgress) => void): Promise<{ kind: 'pdf' | 'photo'; items: PositionedText[] }> {
  onProgress({ stage: 'opening', progress: 0.05 });
  if (isPdfFile(file)) {
    const items = await loadPdfItems(file);
    if (items.length < 5) throw new FriendlyParseError("This PDF is a scan with no text inside. Take a photo of it instead, or type your marks.");
    onProgress({ stage: 'done', progress: 1 });
    return { kind: 'pdf', items };
  }
  if (!file.type.startsWith('image/') && !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)) {
    throw new FriendlyParseError('Use a photo, a screenshot, or a PDF of your result.');
  }
  const canvas = await prepareImage(file);
  onProgress({ stage: 'loading-model', progress: 0.1 });
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress({ stage: 'reading', progress: 0.35 + m.progress * 0.6 });
      else if (/loading|initializ/i.test(m.status)) onProgress({ stage: 'loading-model', progress: 0.1 + m.progress * 0.25 });
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' as never });
    const { data } = await worker.recognize(canvas);
    const items: PositionedText[] = (data.words ?? [])
      .filter((w) => w.text.trim() && w.confidence > 20)
      .map((w) => ({ str: w.text, x: w.bbox.x0, y: -w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 }));
    onProgress({ stage: 'done', progress: 1 });
    if (items.length < 5) throw new FriendlyParseError("We couldn't read text in this photo. Try again in good light, holding the phone straight over the page.");
    return { kind: 'photo', items };
  } finally {
    await worker.terminate();
  }
}

/** Resize so text is ~30px tall, then threshold and strip table lines: much better OCR on result pages. */
async function prepareImage(file: File): Promise<HTMLCanvasElement> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new FriendlyParseError("This image format can't be opened here. Take a screenshot of it and upload that instead.");
  }
  const maxSide = 2600;
  const minSide = 2000;
  const longest = Math.max(bmp.width, bmp.height);
  const scale = longest > maxSide ? maxSide / longest : longest < minSide ? minSide / longest : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  cleanForOcr(img.data, canvas.width, canvas.height);
  ctx.putImageData(img, 0, 0);
  return canvas;
}
