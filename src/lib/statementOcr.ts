/**
 * DigiLocker "Statement of Grade" from a photo/screenshot.
 *
 * Every row prints the same fact several ways, so each total is decided by votes from independent routes:
 *   direct TOTAL cell · EXTERNAL + INTERNAL · grade point × max ÷ 10 · credit points ÷ credits.
 * Finally Σ credit points ÷ Σ credits must reproduce the SGPA printed under the table.
 */
import { roundHalfUp } from './grading';
import type { Grid } from './grid';
import type { OcrWord } from './imagePrep';
import { matchCode, nearCodes, type ImportedMark, type Sem3ImportResult, type Target } from './sem3Import';
import type { OcrEngine, Rect } from './ocrTable';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

async function readBoth(engine: OcrEngine, rect: Rect, whitelist: string): Promise<string[]> {
  const out: string[] = [];
  if (engine.lineAlt) out.push(await engine.lineAlt(rect, whitelist));
  out.push(await engine.line(rect, whitelist));
  return out.map((t) => t.trim()).filter(Boolean);
}

const ints = (texts: string[]) => [...new Set(texts.map((t) => t.replace(/\D+/g, ' ').trim().split(' ').pop()).filter(Boolean).map(Number))];

/** "7.4", "74" (dot lost) → 7.4 when it must be ≤ max. */
function decimals(texts: string[], max: number): number[] {
  const out = new Set<number>();
  for (const t of texts) {
    const m = t.match(/\d+(?:\.\d+)?/g);
    if (!m) continue;
    let v = Number(m[m.length - 1]);
    if (!/\./.test(m[m.length - 1]) && v > max) v = v / 10;
    if (v >= 0 && v <= max) out.add(Math.round(v * 10) / 10);
  }
  return [...out];
}

export interface StatementRead {
  result: Sem3ImportResult;
  printedSgpa: number | null;
  computedSgpa: number | null;
  verified: boolean;
}

export async function readStatementFromImage(engine: OcrEngine, grid: Grid, targets: Target[], known: string[], words: OcrWord[]): Promise<StatementRead | null> {
  const cols = grid.cols;
  const n = cols.length - 1;
  if (n < 15) return null;
  const width = (i: number) => cols[i + 1] - cols[i];
  // Name column: the widest in the left half. Then S.No? | Code | Name | 9 marks | Grade | GP | Credit | CP | Result
  const half = Array.from({ length: Math.floor(n / 2) }, (_, i) => i);
  const nameCol = half.reduce((a, b) => (width(b) > width(a) ? b : a));
  const codeCol = nameCol - 1;
  const m0 = nameCol + 1;
  if (codeCol < 0 || m0 + 12 >= n) return null;
  const C = { extSec: m0 + 2, intSec: m0 + 5, totSec: m0 + 8, gp: m0 + 10, credit: m0 + 11, cp: m0 + 12 };
  const rows = grid.allRows;
  const inset = 3;
  const cell = (c: number, y0: number, y1: number): Rect => ({ left: cols[c] + inset, top: y0 + inset, width: width(c) - inset * 2, height: y1 - y0 - inset * 2 });

  const result: Sem3ImportResult = { marks: {}, electiveCode: null, mdcCode: null, regNo: null, studentName: null, missing: [] };
  const gps: Record<string, number> = {};
  // Bands between rule lines; a band holding two codes (a faint rule was missed) is split evenly.
  const bands: Array<[number, number, string]> = [];
  const unresolved: Array<[number, number, string[]]> = [];
  for (let r = 0; r < rows.length - 1; r++) {
    const [b0, b1] = [rows[r], rows[r + 1]];
    if (b1 - b0 < 10) continue;
    let codes: string[] = [];
    for (const t of await readBoth(engine, cell(codeCol, b0, b1), ALNUM)) {
      const found = t.split(/\s+/).map((tok) => matchCode(tok, known)).filter((c): c is string => !!c);
      if (found.length > codes.length) codes = [...new Set(found)];
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.DEBUG_STATEMENT) console.log('band', b0, b1, JSON.stringify(t), '→', found.join(','));
    }
    if (!codes.length) {
      const tokens = (await readBoth(engine, cell(codeCol, b0, b1), ALNUM)).flatMap((t) => t.split(/\s+/));
      unresolved.push([b0, b1, tokens]);
    }
    codes.forEach((c, i) => bands.push([Math.round(b0 + ((b1 - b0) * i) / codes.length), Math.round(b0 + ((b1 - b0) * (i + 1)) / codes.length), c]));
  }
  // Ambiguous codes ("25CSS0E" ≈ 03/04/05): resolve by elimination against codes already seen.
  const seen = new Set(bands.map((b) => b[2]));
  for (const [b0, b1, tokens] of unresolved) {
    const options = [...new Set(tokens.flatMap((t) => nearCodes(t, known, 1)))].filter((c) => !seen.has(c));
    if (options.length === 1) {
      bands.push([b0, b1, options[0]]);
      seen.add(options[0]);
    }
  }
  bands.sort((a, b) => a[0] - b[0]);
  for (const [y0, y1, code] of bands) {
    const target = targets.find((t) => t.codes.test(code));
    if (!target || result.marks[target.id]) continue;
    const max = target.def.totalMax;
    const credits = target.def.credits;

    const votes = new Map<number, Set<string>>();
    const vote = (v: number, kind: string) => {
      if (!Number.isInteger(v) || v < 0 || v > max) return;
      if (!votes.has(v)) votes.set(v, new Set());
      votes.get(v)!.add(kind);
    };
    for (const v of ints(await readBoth(engine, cell(C.totSec, y0, y1), '0123456789'))) vote(v, 'total');
    const ext = ints(await readBoth(engine, cell(C.extSec, y0, y1), '0123456789'));
    const int = ints(await readBoth(engine, cell(C.intSec, y0, y1), '0123456789'));
    for (const e of ext.length ? ext : [0]) for (const i of int) vote(e + i, 'sum');
    const gpC = decimals(await readBoth(engine, cell(C.gp, y0, y1), '0123456789.'), 10);
    for (const g of gpC) {
      const v = (g * max) / 10;
      if (Math.abs(v - Math.round(v)) < 0.06) vote(Math.round(v), 'gp');
    }
    const cpC = decimals(await readBoth(engine, cell(C.cp, y0, y1), '0123456789.'), 10 * credits);
    for (const cp of cpC) {
      const v = ((cp / credits) * max) / 10;
      if (Math.abs(v - Math.round(v)) < 0.06) vote(Math.round(v), 'cp');
    }
    const ranked = [...votes.entries()].sort((a, b) => b[1].size - a[1].size);
    if (!ranked.length) continue;
    const [total, kinds] = ranked[0];
    const tie = ranked[1] && ranked[1][1].size === kinds.size;
    const mark: ImportedMark = { cia: null, ese: null, total, confidence: kinds.size >= 2 && !tie ? 'high' : 'check' };
    result.marks[target.id] = mark;
    gps[target.id] = Math.round((total / max) * 100) / 10;
  }
  result.missing = targets.map((t) => t.id).filter((id) => !result.marks[id]);

  // Printed SGPA under the table.
  let printedSgpa: number | null = null;
  // SGPA is printed above CGPA under the table: take the first "…GPA"-like label.
  const label = words
    .filter((w) => /[S5$][GC6O0Q][PFR][A4]|SGPA|GPA/i.test(w.text) && !/^CGPA/i.test(w.text.trim()))
    .sort((a, b) => a.bbox.y0 - b.bbox.y0)[0];
  if (label) {
    const h = label.bbox.y1 - label.bbox.y0;
    const rect: Rect = { left: label.bbox.x1 + h * 0.3, top: label.bbox.y0 - h * 0.6, width: Math.max(h * 7, (label.bbox.x1 - label.bbox.x0) * 4), height: h * 2.2 };
    const reads = await readBoth(engine, rect, '0123456789.');
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.DEBUG_STATEMENT) console.log('sgpa label', JSON.stringify(label.text), JSON.stringify(rect), JSON.stringify(reads));
    // Prefer a reading that kept its decimal point ("7.1" over "7").
    // Engines sometimes split it ("7." + "1"): also try the halves joined.
    if (reads.length === 2 && /\d\.$/.test(reads[0]) && /^\d$/.test(reads[1])) reads.push(reads[0] + reads[1]);
    const withDot = decimals(reads.filter((r) => /\d\.\d/.test(r)), 10);
    printedSgpa = withDot[0] ?? decimals(reads, 10)[0] ?? null;
  }
  let computedSgpa: number | null = null;
  let verified = false;
  if (!result.missing.length) {
    const cr = targets.reduce((a, t) => a + t.def.credits, 0);
    computedSgpa = targets.reduce((a, t) => a + gps[t.id] * t.def.credits, 0) / cr;
    verified = printedSgpa != null && roundHalfUp(computedSgpa, 1) === printedSgpa;
    if (verified) for (const id of Object.keys(result.marks)) result.marks[id] = { ...result.marks[id], confidence: 'high' };
  }
  return { result, printedSgpa, computedSgpa, verified };
}
