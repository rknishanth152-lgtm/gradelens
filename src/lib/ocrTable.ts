/**
 * Two-pass OCR for marks tables.
 *  Pass 1 (whole page): find the rows (subject code / name) and the marks columns (CIA, ESE, TOTAL headers).
 *  Pass 2 (per row): re-read only the marks cells with a digits-only reader, then let arithmetic
 *  (CIA + ESE = TOTAL) decide which reading is right.
 * The engine is injected, so the same code runs in the browser and in the offline accuracy script.
 */
import { MDC_OPTIONS, ELECTIVE_OPTIONS } from '../data/subjects';
import { groupLines, type PositionedText } from './pdfParser';
import { importSem3, KNOWN_SEM3_CODES, matchCode, pickMarks, toNumber, TARGETS, type ImportedMark, type Sem3ImportResult, type Target } from './sem3Import';
import { ocrWordsToItems, type OcrWord } from './imagePrep';
import type { Grid } from './grid';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrEngine {
  /** Whole page, general text. */
  page(): Promise<OcrWord[]>;
  /** One strip of the page, restricted to `whitelist` characters, read as a single line. */
  line(rect: Rect, whitelist: string): Promise<string>;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const letters = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Locate the CIA / ESE / TOTAL / RESULT headers. */
export interface MarkColumns {
  left: number;
  right: number;
  headerBottom: number;
  headerTop: number;
  centres: number[];
  cells: Array<{ key: 'cia' | 'ese' | 'tot'; left: number; width: number }>;
}

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Ruled tables (printouts, DigiLocker): read each cell exactly between the grid lines.
 * Returns null when the grid doesn't line up with the CIA / ESE / TOTAL headers.
 */
export async function readSem3FromGrid(engine: OcrEngine, cols: MarkColumns, grid: Grid, targets: Target[] = TARGETS, known: string[] = KNOWN_SEM3_CODES): Promise<Sem3ImportResult | null> {
  const colOf = (x: number) => grid.cols.findIndex((c, i) => i < grid.cols.length - 1 && x > c && x < grid.cols[i + 1]);
  const idx = cols.centres.map(colOf);
  if (idx.some((i) => i < 0) || new Set(idx).size !== 3 || !(idx[0] < idx[1] && idx[1] < idx[2])) return null;
  // Name column = widest column left of CIA; code column = the one just left of it.
  const leftCols = Array.from({ length: idx[0] }, (_, i) => i);
  if (!leftCols.length) return null;
  const nameCol = leftCols.reduce((a, b) => (grid.cols[b + 1] - grid.cols[b] > grid.cols[a + 1] - grid.cols[a] ? b : a));
  const codeCol = nameCol > 0 ? nameCol - 1 : -1;
  const inset = 3;
  const cellRect = (c: number, y0: number, y1: number): Rect => ({ left: grid.cols[c] + inset, top: y0 + inset, width: grid.cols[c + 1] - grid.cols[c] - inset * 2, height: y1 - y0 - inset * 2 });

  const result: Sem3ImportResult = { marks: {}, electiveCode: null, mdcCode: null, regNo: null, studentName: null, missing: [] };
  const used = new Set<string>();
  for (let r = 0; r < grid.rows.length - 1; r++) {
    const y0 = grid.rows[r];
    const y1 = grid.rows[r + 1];
    if (y1 <= cols.headerBottom + 2 || y1 - y0 < 8) continue; // header and above
    let codeHit: string | null = null;
    if (codeCol >= 0) {
      const t = await engine.line(cellRect(codeCol, y0, y1), ALNUM);
      for (const tok of t.split(/\s+/)) codeHit ??= matchCode(tok, known);
    }
    let target = codeHit ? targets.find((x) => x.codes.test(codeHit!)) : undefined;
    let nameText = '';
    if (!target) {
      nameText = await engine.line(cellRect(nameCol, y0, y1), '');
      target = targets.find((x) => !used.has(x.id) && x.words.test(nameText) && !(x.id === 'testing' && /engin/i.test(nameText)) && !(x.id === 'se' && /testing/i.test(nameText)));
    }
    if (!target || used.has(target.id)) continue;
    used.add(target.id);
    const read = async (c: number) => {
      const t = (await engine.line(cellRect(c, y0, y1), '0123456789')).replace(/\D+/g, ' ').trim();
      return t ? Number(t.split(' ').pop()) : null;
    };
    const [cia, ese, tot] = [await read(idx[0]), await read(idx[1]), await read(idx[2])];
    const picked = decideMarks(cia, target.def.eseMax > 0 ? ese : null, tot, target.def);
    if (picked) result.marks[target.id] = codeHit ? picked : { ...picked, confidence: picked.confidence === 'high' ? 'high' : 'check' };
    if (target.id === 'elective') result.electiveCode = codeHit ?? (/swarm|distributed|intelligence/i.test(nameText) ? ELECTIVE_OPTIONS[1].code : ELECTIVE_OPTIONS[0].code);
    if (target.id === 'mdc') result.mdcCode = codeHit && MDC_OPTIONS.some((o) => o.code === codeHit) ? codeHit : /food|ayurveda|nutrition/i.test(nameText) ? '25MDC27' : codeHit ? '25MDCxx' : '25MDC33';
  }
  result.missing = targets.map((t) => t.id).filter((id) => !result.marks[id]);
  return result;
}

/** Per subject, keep the better of two readings ('high' beats 'check' beats nothing). */
export function mergeResults(a: Sem3ImportResult, b: Sem3ImportResult | null, targets: Target[] = TARGETS): Sem3ImportResult {
  if (!b) return a;
  const marks = { ...a.marks };
  for (const [id, m] of Object.entries(b.marks)) {
    const cur = marks[id];
    if (!cur || (cur.confidence === 'check' && m.confidence === 'high')) marks[id] = m;
  }
  return {
    ...a,
    marks,
    electiveCode: b.marks.elective && (!a.marks.elective || a.marks.elective.confidence === 'check') ? b.electiveCode ?? a.electiveCode : a.electiveCode ?? b.electiveCode,
    mdcCode: b.marks.mdc && (!a.marks.mdc || a.marks.mdc.confidence === 'check') ? b.mdcCode ?? a.mdcCode : a.mdcCode ?? b.mdcCode,
    missing: targets.map((t) => t.id).filter((id) => !marks[id]),
  };
}

export function findMarkColumns(words: OcrWord[]): MarkColumns | null {
  const is = (w: OcrWord, re: RegExp) => re.test(letters(w.text));
  const CIA = /^(CIA|C1A|CLA|GIA|CA|CIAS)$/;
  const ESE = /^(ESE|E5E|F5E|FSE|ESF|EBE|ESES)$/;
  const TOT = /^(TOTAL|T0TAL|TOTA|TOTAI|IOTAL|TOTL|OTAL)$/;
  const RES = /^(RESULT|RESUIT|RESULF|RESLT|ESULT)$/;
  const sameLine = (a: OcrWord, b: OcrWord) => Math.abs(a.bbox.y0 - b.bbox.y0) < Math.max(a.bbox.y1 - a.bbox.y0, 12) * 1.2;
  // Pick the header line where the columns appear left to right: CIA < ESE < TOTAL (< RESULT).
  let best: { cia?: OcrWord; ese?: OcrWord; tot?: OcrWord; res?: OcrWord; n: number } = { n: 0 };
  const seeds = words.filter((w) => is(w, CIA) || is(w, ESE) || is(w, TOT));
  for (const s of seeds) {
    const row = words.filter((w) => sameLine(w, s));
    const cia = row.find((w) => is(w, CIA));
    const ese = row.find((w) => is(w, ESE) && (!cia || w.bbox.x0 > cia.bbox.x1));
    const tot = row.find((w) => is(w, TOT) && (!ese || w.bbox.x0 > ese.bbox.x1) && (!cia || w.bbox.x0 > cia.bbox.x1));
    const res = row.find((w) => is(w, RES) && (!tot || w.bbox.x0 > tot.bbox.x1));
    const n = [cia, ese, tot].filter(Boolean).length;
    if (n > best.n) best = { cia, ese, tot, res, n };
  }
  if (best.n < 2) return null;
  const { cia, ese, tot, res } = best;
  const anchors = [cia, ese, tot].filter(Boolean) as OcrWord[];
  const h = Math.max(...anchors.map((w) => w.bbox.y1 - w.bbox.y0));
  const left = (cia ?? ese ?? tot)!.bbox.x0 - h * 1.2;
  const rightEdge = tot ? tot.bbox.x1 + h * 0.9 : ese!.bbox.x1 + h * 4;
  const right = res ? Math.min(rightEdge, res.bbox.x0 - h * 0.2) : rightEdge;
  if (right - left < h * 3) return null;

  // One cell per column, centred under its header (fill in a missing header by spacing).
  const cxOf = (w?: OcrWord) => (w ? (w.bbox.x0 + w.bbox.x1) / 2 : null);
  let [c1, c2, c3] = [cxOf(cia), cxOf(ese), cxOf(tot)];
  if (c2 == null && c1 != null && c3 != null) c2 = (c1 + c3) / 2;
  if (c1 == null && c2 != null && c3 != null) c1 = c2 - (c3 - c2);
  if (c3 == null && c1 != null && c2 != null) c3 = c2 + (c2 - c1);
  const centres = [c1!, c2!, c3!];
  const keys = ['cia', 'ese', 'tot'] as const;
  const cells = centres.map((cx, i) => {
    const gapL = i > 0 ? cx - centres[i - 1] : centres[1] - centres[0];
    const gapR = i < 2 ? centres[i + 1] - cx : centres[2] - centres[1];
    // Numbers may be left-aligned (printouts) or centred (web page): lean the cell left.
    let l = cx - gapL * 0.56;
    let r = cx + gapR * 0.44;
    if (i === 2 && res) r = Math.min(r, res.bbox.x0 - 2);
    l = Math.max(0, l);
    return { key: keys[i], left: Math.round(l), width: Math.max(8, Math.round(r - l)) };
  });
  return { left, right, headerBottom: Math.max(...anchors.map((w) => w.bbox.y1)), headerTop: Math.min(...anchors.map((w) => w.bbox.y0)), centres, cells };
}

/** Read Sem 3 marks from an image with two passes. */
export async function readSem3FromImage(engine: OcrEngine, grid: Grid | null = null, targets: Target[] = TARGETS, known: string[] = KNOWN_SEM3_CODES): Promise<Sem3ImportResult> {
  const words = await engine.page();
  const items = ocrWordsToItems(words);
  const base = importSem3(items, targets); // pass-1 result, used as a fallback and for reg no / name
  // Header not readable (e.g. "TOTALRESULT" glued)? On a ruled sheet the last four columns are
  // CIA | ESE | TOTAL | RESULT in this college's layout, so take them from the grid.
  const cols = findMarkColumns(words) ?? (grid ? columnsFromGrid(grid) : null);
  if (!cols) return base;
  // Ruled table: read cell by cell between the grid lines first.
  const fromGrid = grid ? await readSem3FromGrid(engine, cols, grid, targets, known) : null;
  if (fromGrid && Object.values(fromGrid.marks).filter((m) => m.confidence === 'high').length >= targets.length - 2) {
    return crossCheck({ ...mergeResults(fromGrid, base, targets), regNo: base.regNo, studentName: base.studentName }, base, targets);
  }

  // Lines with their pixel boxes.
  const lines = groupLines(items).map((l) => {
    const box: Box = {
      x0: Math.min(...l.items.map((i) => i.x)),
      x1: Math.max(...l.items.map((i) => i.x + i.w)),
      y0: Math.min(...l.items.map((i) => -i.y)),
      y1: Math.max(...l.items.map((i) => -i.y + i.h)),
    };
    // Only the text left of the marks columns identifies the subject.
    const label = l.items.filter((i) => i.x + i.w < cols.left + 4).map((i) => i.str).join(' ');
    return { box, label, text: l.text, h: Math.max(...l.items.map((i) => i.h)) };
  });
  const medianH = [...lines.map((l) => l.h)].sort((a, b) => a - b)[Math.floor(lines.length / 2)] || 20;
  // Typical distance between table rows, for sizing each read box.
  const tableYs = lines.map((l) => l.box.y0).filter((y) => y > cols.headerBottom).sort((a, b) => a - b);
  const gaps = tableYs.slice(1).map((y, i) => y - tableYs[i]).filter((g) => g > medianH * 0.8 && g < medianH * 6).sort((a, b) => a - b);
  const spacing = gaps.length ? gaps[Math.floor(gaps.length / 2)] : medianH * 2;

  const result: Sem3ImportResult = { ...base, marks: { ...base.marks } };
  const used = new Set<number>();
  for (const target of targets) {
    let idx = -1;
    let codeHit: string | null = null;
    for (let i = 0; i < lines.length && idx < 0; i++) {
      if (used.has(i) || lines[i].box.y0 < cols.headerBottom - 2) continue;
      for (const tok of lines[i].label.split(/\s+/)) {
        const c = matchCode(tok, known);
        if (c && target.codes.test(c)) {
          idx = i;
          codeHit = c;
          break;
        }
      }
    }
    for (let i = 0; i < lines.length && idx < 0; i++) {
      if (used.has(i) || lines[i].box.y0 < cols.headerBottom - 2) continue;
      const t = lines[i].label || lines[i].text;
      if (!target.words.test(t)) continue;
      if (target.id === 'testing' && /engin/i.test(t)) continue;
      if (target.id === 'se' && /testing/i.test(t)) continue;
      idx = i;
    }
    if (idx < 0) continue;
    used.add(idx);
    const ln = lines[idx];
    const rowH = Math.max(ln.box.y1 - ln.box.y0, medianH);
    const mid = (ln.box.y0 + ln.box.y0 + rowH) / 2;
    // Generous box; the cell enhancer keeps only the ink band nearest the middle.
    const span = Math.max(rowH * 2, Math.min(spacing * 1.3, rowH * 3.5));
    const top = Math.max(0, Math.round(mid - span / 2));
    const height = Math.round(span);

    // Each marks cell on its own, digits only.
    const cell: Record<string, number | null> = {};
    for (const c of cols.cells) {
      const txt = await engine.line({ left: c.left, top, width: c.width, height }, '0123456789');
      const n = txt.replace(/\D+/g, ' ').trim().split(' ').map(Number).filter((v) => Number.isFinite(v) && txt.trim() !== '');
      cell[c.key] = n.length === 1 ? n[0] : n.length > 1 ? n[n.length - 1] : null;
    }
    let picked: ImportedMark | null = decideMarks(cell.cia, cell.ese, cell.tot, target.def);

    // Fallback: the whole marks strip in one read (helps when columns are misaligned).
    if (!picked || picked.confidence === 'check') {
      const text = await engine.line({ left: Math.max(0, Math.round(cols.left)), top, width: Math.round(cols.right - cols.left), height }, '0123456789');
      const nums = text.split(/\s+/).map((t) => toNumber(t)).filter((n): n is number => n != null);
      for (const cand of [pickMarks(nums, target.def), target.def.eseMax > 0 ? pickMarks(splitGlued(text), target.def) : null]) {
        if (cand && cand.confidence === 'high') picked = cand;
        else if (cand && !picked) picked = cand;
      }
    }
    const prior = base.marks[target.id];
    if (picked && (picked.confidence === 'high' || !prior || prior.confidence === 'check')) {
      result.marks[target.id] = codeHit || picked.confidence === 'high' ? picked : { ...picked, confidence: 'check' };
    }
    if (target.id === 'elective') {
      result.electiveCode = codeHit ?? (/swarm|distributed|intelligence/i.test(ln.text) ? ELECTIVE_OPTIONS[1].code : /extended|reality|interactive/i.test(ln.text) ? ELECTIVE_OPTIONS[0].code : result.electiveCode);
    }
    if (target.id === 'mdc') {
      const code: string | null = codeHit;
      result.mdcCode = code && MDC_OPTIONS.some((o) => o.code === code) ? code : /food|ayurveda|nutrition/i.test(ln.text) ? '25MDC27' : /bharathiya|principles/i.test(ln.text) ? '25MDC33' : result.mdcCode;
    }
  }
  result.missing = targets.map((t) => t.id).filter((id) => !result.marks[id]);
  return crossCheck(fromGrid ? { ...mergeResults(fromGrid, result, targets), regNo: base.regNo, studentName: base.studentName } : result, base, targets);
}

export function columnsFromGrid(grid: Grid): MarkColumns | null {
  const n = grid.cols.length - 1; // number of column intervals
  if (n < 5) return null;
  const mid = (i: number) => (grid.cols[i] + grid.cols[i + 1]) / 2;
  const centres = [mid(n - 4), mid(n - 3), mid(n - 2)];
  const keys = ['cia', 'ese', 'tot'] as const;
  const cells = [n - 4, n - 3, n - 2].map((c, i) => ({ key: keys[i], left: grid.cols[c] + 3, width: grid.cols[c + 1] - grid.cols[c] - 6 }));
  return { left: grid.cols[n - 4], right: grid.cols[n - 1], headerTop: grid.rows[0], headerBottom: grid.rows[0], centres, cells };
}

/**
 * Internal-only papers print the same number twice, so one misread digit repeats in both cells.
 * Keep them 'sure' only if the independent whole-page reading agrees.
 */
function crossCheck(r: Sem3ImportResult, base: Sem3ImportResult, targets: Target[]): Sem3ImportResult {
  const marks = { ...r.marks };
  for (const t of targets) {
    const m = marks[t.id];
    if (m && m.confidence === 'high' && t.def.eseMax === 0 && base.marks[t.id]?.total !== m.total) marks[t.id] = { ...m, confidence: 'check' };
  }
  return { ...r, marks };
}

/** "1625 41" → [16, 25, 41]: split runs of 3–4 digits into 2-digit numbers. */
export function splitGlued(text: string): number[] {
  const out: number[] = [];
  for (const tok of text.split(/[^0-9]+/).filter(Boolean)) {
    if (tok.length === 4) out.push(Number(tok.slice(0, 2)), Number(tok.slice(2)));
    else if (tok.length === 3 && Number(tok) > 100) out.push(Number(tok.slice(0, 1)), Number(tok.slice(1)));
    else out.push(Number(tok));
  }
  return out;
}

export type { PositionedText };

const digitsDiffer = (a: number, b: number) => {
  const x = String(a);
  const y = String(b);
  if (x.length !== y.length) return 99;
  let d = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
  return d;
};

/**
 * Decide a subject's marks from separately-read CIA / ESE / TOTAL cells.
 * Arithmetic is the referee: CIA + ESE must equal TOTAL.
 */
export function decideMarks(cia: number | null, ese: number | null, total: number | null, def: { ciaMax: number; eseMax: number; totalMax: number }): ImportedMark | null {
  const okCia = cia != null && cia <= def.ciaMax;
  const okEse = ese != null && ese <= def.eseMax;
  const okTot = total != null && total <= def.totalMax;
  if (def.eseMax === 0) {
    // Internal-only paper: CIA and TOTAL repeat the same number.
    if (okCia && okTot && cia === total) return { cia, ese: null, total: total!, confidence: total! >= def.totalMax * 0.3 ? 'high' : 'check' };
    if (okTot) return { cia: okCia ? cia : null, ese: null, total: total!, confidence: 'check' };
    if (okCia) return { cia, ese: null, total: cia!, confidence: 'check' };
    return null;
  }
  if (okCia && okEse) {
    const sum = cia! + ese!;
    // Only 'sure' when the sum checks out AND the total is plausible (very low totals are usually misreads).
    if (okTot && sum === total) return { cia, ese, total: sum, confidence: sum >= def.totalMax * 0.3 && cia! >= 2 && ese! >= 2 ? 'high' : 'check' };
    // One misread digit in the total (67 read as 87): trust the parts, but ask to check.
    if (sum <= def.totalMax) return { cia, ese, total: sum, confidence: 'check' };
  }
  if (okTot) return { cia: okCia ? cia : null, ese: okEse ? ese : null, total: total!, confidence: 'check' };
  return null;
}
export { digitsDiffer };
