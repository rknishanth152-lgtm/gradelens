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
import { gradePoint, roundHalfUp } from './grading';
import { detectGrid, detectVerticalLines } from './grid';
import { readSem3FromImage, type OcrEngine } from './ocrTable';
import { importSem3, KNOWN_SEM3_CODES, TARGETS, type Sem3ImportResult, type Target } from './sem3Import';

export type ReadStage = 'opening' | 'loading-model' | 'reading' | 'checking' | 'done';
export interface ReadProgress {
  stage: ReadStage;
  /** 0–1 */
  progress: number;
}

type TessWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;
let tessPromise: Promise<TessWorker> | null = null;
let tessLog: ((m: { status: string; progress: number }) => void) | null = null;

/** One shared tesseract worker for the whole visit (created once, reused by every upload). */
function loadTesseract(): Promise<TessWorker> {
  tessPromise ??= import('tesseract.js')
    .then(({ createWorker }) => createWorker('eng', 1, { logger: (m: { status: string; progress: number }) => tessLog?.(m) }))
    .catch((e) => {
      tessPromise = null;
      throw e;
    });
  return tessPromise;
}

/**
 * Start downloading both readers in the background as soon as a student opens an upload option,
 * so most of the one-time download is done before they've picked their screenshot.
 * Skipped when the phone asks to save data.
 */
export function warmUpReaders(): void {
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (conn?.saveData) return;
  void loadPaddle();
  void loadTesseract().catch(() => undefined);
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
  let source: Raster;
  if (isPdfFile(file)) {
    const items = await loadPdfItems(file);
    if (items.length >= 5) {
      onProgress({ stage: 'done', progress: 1 });
      return { kind: 'pdf', result: importSem3(items, targets) };
    }
    // A picture saved as PDF (scanner apps, "JPG to PDF" sites): render the page and read it like a photo.
    source = await renderPdfPage(file);
  } else if (isImageFile(file)) {
    source = await decodeImage(file);
  } else {
    throw new FriendlyParseError('Use a screenshot, a photo, or a PDF of your result.');
  }

  const raster = prepareForOcr(source);
  const grid = detectGrid(raster);
  const vlines = detectVerticalLines(raster);
  onProgress({ stage: 'loading-model', progress: 0.12 });
  const paddleLoading = loadPaddle();
  let phase: 'page' | 'cells' = 'page';
  let cellsRead = 0;
  tessLog = (m) => {
    if (phase === 'page' && m.status === 'recognizing text') onProgress({ stage: 'reading', progress: 0.3 + m.progress * 0.3 });
    else if (phase === 'page' && /loading|initializ/i.test(m.status)) onProgress({ stage: 'loading-model', progress: 0.12 + m.progress * 0.18 });
  };
  const worker = await loadTesseract();
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
      // Many-column grid = DigiLocker Statement of Grade, unless the page is clearly a printed
      // "Statement of Marks" (that layout is read by the secured-columns reader instead).
      const text = words.map((w) => w.text).join(' ');
      const isDigiLocker = !/SECURED|STATEMENT\s+OF\s+MARKS|CHOICE\s+BASED/i.test(text);
      const st = isDigiLocker ? await readStatementFromImage(engine, grid, targets, known, words) : null;
      if (st && Object.keys(st.result.marks).length) {
        onProgress({ stage: 'done', progress: 1 });
        return { kind: 'photo', result: st.result, printedSgpa: st.printedSgpa, verified: st.verified };
      }
    }
    let result = await readSem3FromImage(engine, grid, targets, known, vlines);
    if (opts.statement) {
      const v = verifyPartIII(result, targets);
      if (v.verified) result = v.result;
      onProgress({ stage: 'done', progress: 1 });
      return { kind: 'photo', result, printedSgpa: v.printed, verified: v.verified };
    }
    onProgress({ stage: 'done', progress: 1 });
    return { kind: 'photo', result };
  } finally {
    // Keep the reader alive: the next upload starts instantly.
    tessLog = null;
  }
}

/** Render page 1 of an image-only PDF to pixels (~2200px wide). */
async function renderPdfPage(file: File): Promise<Raster> {
  const [pdfjs, worker] = await Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, Math.max(1, 2200 / base.width)) });
    const c = document.createElement('canvas');
    c.width = Math.round(viewport.width);
    c.height = Math.round(viewport.height);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport } as never).promise;
    await doc.destroy();
    const img = ctx.getImageData(0, 0, c.width, c.height);
    return { data: img.data, width: img.width, height: img.height };
  } catch {
    throw new FriendlyParseError("This PDF wouldn't open. Take a screenshot of it and upload that instead.");
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

/**
 * Printed "Statement of Marks" sheets list SGPA per Part at the bottom; Part III is exactly the counted
 * SGPA ("III  15  7.1  7.2"). If the marks we read reproduce it, they're confirmed.
 */
export function verifyPartIII(result: Sem3ImportResult, targets: Target[]): { result: Sem3ImportResult; printed: number | null; verified: boolean } {
  const credits = targets.reduce((a, t) => a + t.def.credits, 0);
  let printed: number | null = null;
  for (const line of (result.pageText ?? '').split('\n')) {
    const m = /(?:^|\s)(?:III|Ill|lll|1II|II1|111|IIl)\s+(\d{1,2})\s+(\d{1,2})[.,](\d)\b/.exec(line);
    if (m && Number(m[1]) === credits) {
      printed = Number(m[2] + '.' + m[3]);
      break;
    }
  }
  if (printed == null || targets.some((t) => !result.marks[t.id])) return { result, printed, verified: false };
  const sgpa = targets.reduce((a, t) => a + gradePoint(result.marks[t.id].total, t.def.totalMax) * t.def.credits, 0) / credits;
  if (roundHalfUp(sgpa, 1) !== printed) return { result, printed, verified: false };
  const marks = Object.fromEntries(Object.entries(result.marks).map(([k, m]) => [k, { ...m, confidence: 'high' as const }]));
  return { result: { ...result, marks }, printed, verified: true };
}
