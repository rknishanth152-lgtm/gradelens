/**
 * Accuracy check against real marksheets kept in test-fixtures/private (git-ignored).
 * Run: npx vite-node scripts/eval-samples.ts [file-filter]
 * Mirrors the browser pipeline: decode → scale → cleanForOcr → tesseract → parsers.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { createWorker } from 'tesseract.js';
import { extractPdfItems, parseItems, sheetTotals, verifySheet, type PositionedText } from '../src/lib/pdfParser';
import { importSem3, prevTargets, KNOWN_PREV_CODES } from '../src/lib/sem3Import';
import { prepareForOcr, ocrWordsToItems, OCR_PARAMS, enhanceCell, cropRaster, tightRect, type OcrWord, type Raster } from '../src/lib/imagePrep';
import { readSem3FromImage, type OcrEngine } from '../src/lib/ocrTable';
import { detectGrid } from '../src/lib/grid';
import { readStatementFromImage } from '../src/lib/statementOcr';
import { roundHalfUp } from '../src/lib/grading';
import { PaddleRecognizer } from '../src/lib/paddleRec';

let paddle: PaddleRecognizer | null = null;
if (process.env.ENGINE === 'paddle') {
  const ort = await import(`file:///${process.env.TOOLS}/node_modules/onnxruntime-node/dist/index.js`);
  const cache = `${process.env.USERPROFILE}/.cache/ppu-paddle-ocr`;
  paddle = await PaddleRecognizer.create((ort.default ?? ort) as never, readFileSync(`${cache}/en_PP-OCRv5_mobile_rec_infer.ort`), readFileSync(`${cache}/ppocrv5_en_dict.txt`, 'utf8'));
}

const DIR = resolve(__dirname, '../test-fixtures/private');
const expected = JSON.parse(readFileSync(join(DIR, 'expected.json'), 'utf8'));
const filter = process.argv[2];

function decode(file: string) {
  const buf = readFileSync(file);
  if (/\.png$/i.test(file)) {
    const p = PNG.sync.read(buf);
    return { data: new Uint8ClampedArray(p.data.buffer, p.data.byteOffset, p.data.length), width: p.width, height: p.height };
  }
  const j = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true });
  return { data: new Uint8ClampedArray(j.data.buffer), width: j.width, height: j.height };
}

function digitsFromText(t: string) {
  return t.replace(/[Oo°QD]/g, '0').replace(/[Il|!\]\[]/g, '1').replace(/[Ss$]/g, '5').replace(/[Zz]/g, '2').replace(/B/g, '8').replace(/[Gb]/g, '6').replace(/[T]/g, '7').replace(/[^0-9\s]/g, '');
}

function toPng(r: Raster) {
  const png = new PNG({ width: r.width, height: r.height });
  png.data = Buffer.from(r.data.buffer, r.data.byteOffset, r.data.length);
  return PNG.sync.write(png);
}

async function engineFor(file: string): Promise<{ engine: OcrEngine; done: () => Promise<void>; grid: ReturnType<typeof detectGrid> }> {
  const img = prepareForOcr(decode(file));
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer);
  const buf = PNG.sync.write(png);
  const worker = await createWorker('eng', 1);
  const engine: OcrEngine = {
    async page() {
      await worker.setParameters({ ...OCR_PARAMS, tessedit_char_whitelist: '' } as never);
      const { data } = await worker.recognize(buf);
      if (process.env.SHOW_TEXT) console.log(data.text);
      return (data.words ?? []) as OcrWord[];
    },
    async line(rect, whitelist) {
      await worker.setParameters({ tessedit_pageseg_mode: process.env.PSM ?? '7', tessedit_char_whitelist: process.env.NOWL && whitelist === '0123456789' ? '' : whitelist } as never);
      if (rect.width < 6 || rect.height < 6) return '';
      const cellImg = enhanceCell(img, rect);
      const { data } = await worker.recognize(toPng(cellImg));
      if (process.env.NOWL && whitelist === '0123456789') data.text = digitsFromText(data.text);
      if (process.env.SHOW_CELLS) console.log('   cell', JSON.stringify(rect), '→', JSON.stringify(data.text.trim()));
      if (process.env.SAVE_CELLS) {
        (await import('node:fs')).writeFileSync(`${process.env.SAVE_CELLS}/${rect.top}-${rect.left}-${rect.width}.png`, toPng(cellImg));
      }
      return data.text;
    },
  };
  if (paddle) {
    const p = paddle;
    engine.lineAlt = async (rect, whitelist) => (rect.width < 6 || rect.height < 6 ? '' : (await p.recognize(process.env.PADDLE_PREP === 'enhance' ? enhanceCell(img, rect) : cropRaster(img, tightRect(img, rect)), whitelist || undefined)).text);
  }
  return { engine, done: () => worker.terminate(), grid: detectGrid(img) };
}

async function itemsFor(file: string): Promise<PositionedText[]> {
  if (/\.pdf$/i.test(file)) {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const require = createRequire(import.meta.url);
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
    return extractPdfItems(pdfjs as never, new Uint8Array(readFileSync(file)));
  }
  const img = decode(file);
  const prepped = prepareForOcr(img);
  const png = new PNG({ width: prepped.width, height: prepped.height });
  png.data = Buffer.from(prepped.data.buffer);
  const worker = await createWorker('eng', 1);
  await worker.setParameters(OCR_PARAMS as never);
  const { data } = await worker.recognize(PNG.sync.write(png));
  await worker.terminate();
  if (process.env.SHOW_TEXT) console.log(data.text);
  return ocrWordsToItems(data.words ?? []);
}

let pass = 0;
let total = 0;
for (const f of readdirSync(DIR).filter((f) => expected[f] && (!filter || f.includes(filter)))) {
  const exp = expected[f];
  const t0 = Date.now();
  const items = !/\.pdf$/i.test(f) ? [] : await itemsFor(join(DIR, f));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (exp.kind === 'sem3' || exp.kind === 'prevResult') {
    const targets = exp.kind === 'prevResult' ? prevTargets(exp.sem) : undefined;
    const known = exp.kind === 'prevResult' ? KNOWN_PREV_CODES[exp.sem as 1 | 2] : undefined;
    let r = importSem3(items, targets);
    if (!/\.pdf$/i.test(f)) {
      const { engine, done, grid } = await engineFor(join(DIR, f));
      r = await readSem3FromImage(engine, grid, targets, known);
      await done();
    }
    const rows = Object.entries(exp.marks as Record<string, number>).map(([id, want]) => {
      const got = r.marks[id];
      const ok = got?.total === want;
      total++;
      if (ok) pass++;
      return `${ok ? 'ok ' : 'BAD'} ${id.padEnd(9)} want ${String(want).padStart(3)} got ${String(got?.total ?? '-').padStart(3)} ${got?.confidence ?? ''}`;
    });
    const meta = exp.kind === 'prevResult' ? `sem ${exp.sem}` : `elective ${r.electiveCode === exp.electiveCode ? 'ok' : `BAD(${r.electiveCode})`}, mdc ${r.mdcCode === exp.mdcCode ? 'ok' : `BAD(${r.mdcCode})`}`;
    console.log(`\n== ${f} (${secs}s, ${items.length} items) ${meta}\n  ${rows.join('\n  ')}`);
  } else if (!/\.pdf$/i.test(f)) {
    const { engine, done, grid } = await engineFor(join(DIR, f));
    const words = await engine.page();
    const st = grid ? await readStatementFromImage(engine, grid, prevTargets(exp.sem), KNOWN_PREV_CODES[exp.sem as 1 | 2], words) : null;
    await done();
    const rows = Object.entries(exp.marks as Record<string, number>).map(([id, want]) => {
      const got = st?.result.marks[id];
      const ok = got?.total === want;
      total++;
      if (ok) pass++;
      return `${ok ? 'ok ' : 'BAD'} ${id.padEnd(9)} want ${String(want).padStart(3)} got ${String(got?.total ?? '-').padStart(3)} ${got?.confidence ?? ''}`;
    });
    console.log(`\n== ${f} statement: printed ${st?.printedSgpa} computed ${st?.computedSgpa?.toFixed(2)} verified ${st?.verified}\n  ${rows.join('\n  ')}`);
  } else {
    const sheet = parseItems(items, f);
    const t = sheetTotals(sheet.subjects);
    const v = verifySheet(sheet);
    total++;
    const ok = exp.verifyOnly ? v.status === 'verified' : Math.abs(t.creditPoints - exp.creditPoints) < 0.01 && t.credits === exp.credits;
    if (ok) pass++;
    console.log(`\n== ${f} (${secs}s) ${ok ? 'ok' : 'BAD'}: sem ${sheet.semester}, ${sheet.subjects.length} subjects, CP ${t.creditPoints}/${t.credits} → ${roundHalfUp(t.sgpa, 1)} vs printed ${sheet.printedSgpa} (${v.status})`);
    for (const s of sheet.subjects) console.log(`   ${s.code.padEnd(9)} ${String(s.totalSecured).padStart(4)}/${String(s.totalMax).padEnd(4)} cr ${s.credits} ${s.grade} ${s.result}`);
  }
}
console.log(`\nSCORE ${pass}/${total}`);
