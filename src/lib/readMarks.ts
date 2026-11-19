/**
 * Read a marks table from an uploaded PDF or image, entirely in the browser.
 *  - PDF: its text layer (pdf.js).
 *  - Image: two-pass OCR (tesseract.js): find rows/columns (and table grid lines if ruled),
 *    then re-read every marks cell digits-only and let CIA + ESE = TOTAL referee.
 * The image never leaves the device; the first photo downloads the OCR model (~4 MB) once.
 */
import { FriendlyParseError, isPdfFile, loadPdfItems, type PositionedText } from './pdfParser';
import { cropRaster, enhanceCell, OCR_PARAMS, prepareForOcr, tightRect, type OcrWord, type Raster } from './imagePrep';
import { PaddleRecognizer } from './paddleRec';
import { readStatementFromImage } from './statementOcr';
import { detectGrid } from './grid';
import { readSem3FromImage, type OcrEngine } from './ocrTable';
import { importSem3, KNOWN_SEM3_CODES, TARGETS, type Sem3ImportResult, type Target } from './sem3Import';

export type ReadStage = 'opening' | 'loading-model' | 'reading' | 'checking' | 'done';
export interface ReadProgress {
  stage: ReadStage;
  /** 0–1 */
  progress: number;
}

let paddlePromise: Promise<PaddleRecognizer | null> | null = null;

/** PaddleOCR recognizer (self-hosted model + ONNX Runtime WASM). Null if it can't load: tesseract alone still works. */
export function loadPaddle(): Promise<PaddleRecognizer | null> {
  paddlePromise ??= (async () => {
    try {
      const ort = await import('onnxruntime-web/wasm');
      ort.env.wasm.wasmPaths = `${import.meta.env.BASE_URL}ort/`;
      ort.env.wasm.numThreads = 1;
      const base = `${import.meta.env.BASE_URL}ocr/`;
      const [model, dict] = await Promise.all([
        fetch(`${base}en_rec.ort`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('model')))),
        fetch(`${base}en_dict.txt`).then((r) => (r.ok ? r.text() : Promise.reject(new Error('dict')))),
      ]);
      return await PaddleRecognizer.create(ort as never, new Uint8Array(model), dict, { executionProviders: ['wasm'] });
    } catch {
      paddlePromise = null;
      return null;
    }
  })();
  return paddlePromise;
}

export const isImageFile = (file: File) => file.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name);

/** PDF text items (for DigiLocker parsing and text-layer tables). */
export async function readPdfItems(file: File): Promise<PositionedText[]> {
  const items = await loadPdfItems(file);
  if (items.length < 5) throw new FriendlyParseError('This PDF is a scan with no text inside. Upload a screenshot of it instead, or type your marks.');
  return items;
}

/** Any marks table (PDF or image) → marks for the given subjects. */
export async function readMarksTable(
  file: File,
  onProgress: (p: ReadProgress) => void,
  targets: Target[] = TARGETS,
  known: string[] = KNOWN_SEM3_CODES,
  opts: { statement?: boolean } = {},
): Promise<{ kind: 'pdf' | 'photo'; result: Sem3ImportResult; printedSgpa?: number | null; verified?: boolean }> {
  onProgress({ stage: 'opening', progress: 0.05 });
  if (isPdfFile(file)) {
    const items = await readPdfItems(file);
    onProgress({ stage: 'done', progress: 1 });
    return { kind: 'pdf', result: importSem3(items, targets) };
  }
  if (!isImageFile(file)) throw new FriendlyParseError('Use a screenshot, a photo, or a PDF of your result.');

  const raster = prepareForOcr(await decodeImage(file));
  const grid = detectGrid(raster);
  onProgress({ stage: 'loading-model', progress: 0.12 });
  const paddleLoading = loadPaddle();
  const { createWorker } = await import('tesseract.js');
  let phase: 'page' | 'cells' = 'page';
  let cellsRead = 0;
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (phase === 'page' && m.status === 'recognizing text') onProgress({ stage: 'reading', progress: 0.3 + m.progress * 0.3 });
      else if (phase === 'page' && /loading|initializ/i.test(m.status)) onProgress({ stage: 'loading-model', progress: 0.12 + m.progress * 0.18 });
    },
  });
  const paddle = await paddleLoading;
  const pageCanvas = toCanvas(raster);
  const engine: OcrEngine = {
    async page() {
      await worker.setParameters({ ...OCR_PARAMS, tessedit_char_whitelist: '' } as never);
      const { data } = await worker.recognize(pageCanvas);
      phase = 'cells';
      return (data.words ?? []) as OcrWord[];
    },
    async line(rect, whitelist) {
      if (rect.width < 6 || rect.height < 6) return '';
      await worker.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: whitelist } as never);
      const { data } = await worker.recognize(toCanvas(enhanceCell(raster, rect)));
      cellsRead++;
      onProgress({ stage: 'checking', progress: Math.min(0.97, 0.6 + cellsRead * 0.009) });
      return data.text;
    },
  };
  if (paddle) {
    engine.lineAlt = async (rect, whitelist) => {
      if (rect.width < 6 || rect.height < 6) return '';
      const r = await paddle.recognize(cropRaster(raster, tightRect(raster, rect)), whitelist || undefined);
      return r.text;
    };
  }
  try {
    // DigiLocker Statement of Grade photo: many columns → cross-checked statement reader.
    if (opts.statement && grid && grid.cols.length - 1 >= 15) {
      const words = await engine.page();
      const st = await readStatementFromImage(engine, grid, targets, known, words);
      if (st && Object.keys(st.result.marks).length) {
        onProgress({ stage: 'done', progress: 1 });
        return { kind: 'photo', result: st.result, printedSgpa: st.printedSgpa, verified: st.verified };
      }
    }
    const result = await readSem3FromImage(engine, grid, targets, known);
    onProgress({ stage: 'done', progress: 1 });
    return { kind: 'photo', result };
  } finally {
    await worker.terminate();
  }
}

async function decodeImage(file: File): Promise<Raster> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new FriendlyParseError("This image format can't be opened here. Take a screenshot of it and upload that instead.");
  }
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return { data: img.data, width: img.width, height: img.height };
}

function toCanvas(r: Raster): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = r.width;
  c.height = r.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.width, r.height), 0, 0);
  return c;
}
