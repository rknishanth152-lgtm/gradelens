/**
 * DigiLocker "Statement of Grade" → structured semester result.
 *
 * The pure part (`parseItems`) takes positioned text items, so it can be unit-tested
 * without a PDF. `parsePdfFile` (browser) and `extractPdfItems` (any pdf.js build) do the I/O.
 */
import { SEM1_SUBJECTS, SEM2_SUBJECTS, SEM3_SUBJECTS, ELECTIVE_OPTIONS, MDC_OPTIONS } from '../data/subjects';
import { isCounted, roundHalfUp, semesterTotals, type SemesterTotals } from './grading';

export interface PositionedText {
  str: string;
  x: number;
  /** PDF user-space y (grows upwards). */
  y: number;
  w: number;
  h: number;
}

export interface ParsedSubject {
  code: string;
  name: string;
  extMax: number | null;
  extSecured: number | null;
  intMax: number | null;
  intSecured: number | null;
  totalMax: number | null;
  totalSecured: number | null;
  grade: string | null;
  gradePoint: number | null;
  credits: number | null;
  creditPoints: number | null;
  result: 'PASS' | 'FAIL' | string | null;
}

export interface ParsedSheet {
  fileName: string;
  studentName: string | null;
  regNo: string | null;
  semester: number | null;
  examMonth: string | null;
  subjects: ParsedSubject[];
  printedSgpa: number | null;
  printedCgpa: number | null;
  warnings: string[];
}

export class FriendlyParseError extends Error {}

export const CODE_RE = /(?<![A-Z0-9])25[A-Z]{3}\d{2}[AB]?(?![0-9])/g;
const CODE_ONE = /^25[A-Z]{3}\d{2}[AB]?$/;
const RESULT_RE = /^(PASS|FAIL|PASSED|FAILED|RA|AB|ABSENT|COMPLETED|WH|RLE)$/i;
const GRADE_RE = /^(O|D|E|A\+{0,2}|B\+{0,2}|C\+?|U|RA|AB|AAA|P|F)$/i;
const NUM_RE = /^\d+(\.\d+)?$/;
const DASH_RE = /^[-–—]+$/;
const MONTHS = 'JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER';
const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

const KNOWN_NAMES: Record<string, string> = Object.fromEntries(
  [...SEM1_SUBJECTS, ...SEM2_SUBJECTS, ...SEM3_SUBJECTS, ...ELECTIVE_OPTIONS, ...MDC_OPTIONS]
    .filter((s) => /^25[A-Z]{3}\d{2}[AB]?$/.test(s.code))
    .map((s) => [s.code, s.name]),
);

const SEM_BY_CODE: Array<[RegExp, number]> = [
  [/^25(CSS0[12][AB]?|MCU06|AEC2[12]|VAC01)$/, 1],
  [/^25(CSS0[345]|MCU14|AEC2[34]|VAC02)$/, 2],
  [/^25(CSS0[678][AB]?|MCU22|CTU0[12]|VAC03|MDC(27|33))$/, 3],
];

interface Token {
  text: string;
  x: number;
  y: number;
}

interface Line {
  y: number;
  items: PositionedText[];
  text: string;
}

const num = (t: string | undefined): number | null => (t != null && NUM_RE.test(t) ? Number(t) : null);

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Group items into visual lines by y with a tolerance. */
export function groupLines(items: PositionedText[], tol?: number): Line[] {
  const clean = items.filter((i) => i.str && i.str.trim());
  const lh = median(clean.map((i) => i.h).filter((h) => h > 0)) || 8;
  const t = tol ?? Math.max(1.5, lh * 0.45);
  const sorted = [...clean].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= t) {
      last.items.push(it);
      last.y = (last.y * (last.items.length - 1) + it.y) / last.items.length;
    } else {
      lines.push({ y: it.y, items: [it], text: '' });
    }
  }
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.text = l.items.map((i) => i.str.trim()).join(' ');
  }
  return lines;
}

/** Split an item into whitespace tokens with an approximate x for each. */
function tokenize(it: PositionedText): Token[] {
  const out: Token[] = [];
  const s = it.str;
  const len = Math.max(s.length, 1);
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push({ text: m[0], x: it.x + (it.w * m.index) / len, y: it.y });
  }
  return out;
}

function findNumberNear(
  lines: Line[],
  label: RegExp,
  lh: number,
): number | null {
  for (let li = 0; li < lines.length; li++) {
    for (const it of lines[li].items) {
      if (!label.test(it.str)) continue;
      // Inline: "SGPA : 7.5"
      const inline = new RegExp(label.source + String.raw`\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\b`, 'i').exec(it.str);
      if (inline && Number(inline[1]) <= 10) return Number(inline[1]);
      const isVal = (s: string) => /^\d{1,2}(\.\d{1,2})?$/.test(s.trim()) && Number(s) <= 10;
      // Same line, to the right (nearest).
      const right = lines[li].items
        .filter((o) => o !== it && o.x > it.x && isVal(o.str.replace(/^[:\-]\s*/, '')))
        .sort((a, b) => a.x - b.x)[0];
      // Before accepting a right-hand value, make sure no other label sits between.
      if (right) {
        const between = lines[li].items.some((o) => o.x > it.x && o.x < right.x && /[A-Z]{3,}/i.test(o.str) && !label.test(o.str));
        if (!between) return Number(right.str.replace(/^[:\-]\s*/, ''));
      }
      // Below, horizontally aligned.
      const cx = it.x + it.w / 2;
      for (let lj = li + 1; lj < lines.length && lines[li].y - lines[lj].y <= lh * 4; lj++) {
        const cand = lines[lj].items
          .filter((o) => isVal(o.str))
          .map((o) => ({ o, d: Math.abs(o.x + o.w / 2 - cx) }))
          .filter((c) => c.d < Math.max(40, it.w * 1.5))
          .sort((a, b) => a.d - b.d)[0];
        if (cand) return Number(cand.o.str);
      }
    }
  }
  return null;
}

function semesterFrom(text: string, fileName: string, codes: string[]): number | null {
  const m = /SEMESTER\s*[:\-]?\s*(VI|IV|V|I{1,3}|[1-6])\b/i.exec(text);
  if (m) return ROMAN[m[1].toUpperCase()] ?? Number(m[1]);
  const f = new RegExp(String.raw`\d{2}[A-Z]{3}\d{3}(VI|IV|V|I{1,3})(?:${MONTHS})`, 'i').exec(fileName.toUpperCase());
  if (f) return ROMAN[f[1].toUpperCase()];
  const votes: Record<number, number> = {};
  for (const c of codes) for (const [re, s] of SEM_BY_CODE) if (re.test(c)) votes[s] = (votes[s] ?? 0) + 1;
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return best ? Number(best[0]) : null;
}

/** Parse positioned text items (all pages concatenated, page offsets already applied). */
export function parseItems(items: PositionedText[], fileName = ''): ParsedSheet {
  const warnings: string[] = [];
  const lines = groupLines(items);
  const fullText = lines.map((l) => l.text).join('\n');
  const lh = median(items.map((i) => i.h).filter((h) => h > 0)) || 8;
  const tol = Math.max(1.5, lh * 0.45);

  // ---- Header fields --------------------------------------------------------
  const regFromText =
    /(?:REG(?:ISTER|ISTRATION)?\.?\s*(?:NO|NUMBER)\.?|ROLL\s*NO\.?)\s*[:\-]?\s*(\d{2}[A-Z]{3}\d{3})/i.exec(fullText)?.[1] ??
    /\b(\d{2}[A-Z]{3}\d{3})\b/.exec(fullText)?.[1] ??
    /(\d{2}[A-Z]{3}\d{3})(?=VI|IV|V|I{1,3})/i.exec(fileName)?.[1] ??
    null;
  const regNo = regFromText ? regFromText.toUpperCase() : null;

  let studentName: string | null = null;
  const nm = /NAME(?:\s+OF\s+THE\s+(?:CANDIDATE|STUDENT))?\s*[:\-]\s*([A-Z][A-Z .']{1,60}?)\s*(?=\n|\b(?:REG|REGISTER|REGISTRATION|ROLL|PROGRAMME|PROGRAM|CLASS|BRANCH|COURSE|DEGREE|DATE|SEMESTER)\b|$)/i.exec(fullText);
  if (nm) studentName = nm[1].trim().replace(/\s+/g, ' ');
  if (!studentName) {
    // Positional fallback: "Name" label then the next item on the line.
    for (const l of lines) {
      const idx = l.items.findIndex((i) => /^NAME(\s+OF\s+THE\s+(CANDIDATE|STUDENT))?\s*:?$/i.test(i.str.trim()));
      if (idx >= 0) {
        const rest = l.items.slice(idx + 1).map((i) => i.str.trim()).filter((s) => s && s !== ':');
        if (rest[0] && /^[A-Z][A-Za-z .']+$/.test(rest[0])) studentName = rest[0];
        break;
      }
    }
  }

  const monthM =
    new RegExp(String.raw`\b(${MONTHS})\s*[-,/ ]?\s*(20\d{2})\b`, 'i').exec(fullText) ??
    new RegExp(String.raw`(20\d{2})\d{2}[A-Z]{3}\d{3}(?:VI|IV|V|I{1,3})(${MONTHS})`, 'i').exec(fileName.toUpperCase());
  let examMonth: string | null = null;
  if (monthM) {
    const [a, b] = /^\d/.test(monthM[1]) ? [monthM[2], monthM[1]] : [monthM[1], monthM[2]];
    examMonth = `${a.charAt(0).toUpperCase()}${a.slice(1).toLowerCase()} ${b}`;
  }

  // ---- Subject rows ---------------------------------------------------------
  interface Anchor { code: string; x: number; y: number; item: PositionedText }
  const anchors: Anchor[] = [];
  for (const l of lines) {
    for (const it of l.items) {
      for (const m of it.str.matchAll(CODE_RE)) {
        const code = m[0];
        // Skip register numbers (25BCT999 doesn't match the code shape, but be safe).
        if (/^\d{2}[A-Z]{3}\d{3}$/.test(code)) continue;
        if (anchors.some((a) => a.code === code && Math.abs(a.y - l.y) <= tol)) continue;
        const x = it.x + (it.w * (m.index ?? 0)) / Math.max(it.str.length, 1);
        anchors.push({ code, x, y: l.y, item: it });
      }
    }
  }
  anchors.sort((a, b) => b.y - a.y);

  const allTokens: Token[] = items.filter((i) => i.str.trim()).flatMap(tokenize);
  const subjects: ParsedSubject[] = [];

  anchors.forEach((a, i) => {
    const prev = anchors[i - 1];
    const next = anchors[i + 1];
    const gapDown = next ? a.y - next.y : prev ? prev.y - a.y : lh * 3;
    const gapUp = prev ? prev.y - a.y : gapDown;
    const top = prev ? (prev.y + a.y) / 2 : a.y + Math.min(gapUp / 2, lh * 2.5);
    const bottom = next ? (a.y + next.y) / 2 : a.y - Math.min(gapDown / 2, lh * 2.5);

    const band = allTokens
      .filter((t) => t.y < top && t.y >= bottom)
      .sort((p, q) => (Math.abs(p.y - q.y) <= tol ? p.x - q.x : q.y - p.y));
    const isCodeTok = (t: Token) => new RegExp(`^${a.code}$`).test(t.text);

    // Data tokens: on the anchor's line, right of the code.
    let rowToks = band.filter((t) => Math.abs(t.y - a.y) <= tol && t.x > a.x && !isCodeTok(t));
    let rIdx = rowToks.findIndex((t) => RESULT_RE.test(t.text));
    if (rIdx < 0) {
      // Numbers may be vertically offset from the code: use the whole band.
      rowToks = band.filter((t) => t.x > a.x && !isCodeTok(t)).sort((p, q) => p.x - q.x);
      rIdx = rowToks.findIndex((t) => RESULT_RE.test(t.text));
    }
    let data: Token[] = [];
    let result: string | null = null;
    if (rIdx >= 0) {
      result = rowToks[rIdx].text.toUpperCase().replace(/^PASSED$/, 'PASS').replace(/^FAILED$/, 'FAIL');
      let s = rIdx - 1;
      while (s >= 0 && rIdx - s <= 13 && (NUM_RE.test(rowToks[s].text) || DASH_RE.test(rowToks[s].text) || GRADE_RE.test(rowToks[s].text))) s--;
      data = rowToks.slice(s + 1, rIdx);
    } else {
      // No result column found: take the numeric run.
      data = rowToks.filter((t) => NUM_RE.test(t.text) || DASH_RE.test(t.text) || GRADE_RE.test(t.text));
    }
    const firstDataX = data[0]?.x ?? (rIdx >= 0 ? rowToks[rIdx].x : Infinity);

    // Name: everything between the code and the data columns, across wrapped lines.
    const nameToks = band.filter((t) => t.x > a.x - 0.5 && t.x < firstDataX - 0.5 && !isCodeTok(t) && !CODE_ONE.test(t.text));
    let name = nameToks.map((t) => t.text).join(' ').replace(/\s+/g, ' ').replace(/^[:\-–\s]+/, '').trim();
    if (!name || name.length < 3) name = KNOWN_NAMES[a.code] ?? a.code;

    // Map data columns, anchored on the grade letter.
    const texts = data.map((t) => t.text.toUpperCase());
    let gIdx = -1;
    for (let k = texts.length - 1; k >= 0; k--) if (!NUM_RE.test(texts[k]) && !DASH_RE.test(texts[k]) && GRADE_RE.test(texts[k])) { gIdx = k; break; }
    let grade: string | null = null;
    let gp: number | null = null, cr: number | null = null, cp: number | null = null;
    let totSec: number | null = null, totMax: number | null = null;
    let extMax: number | null = null, extSec: number | null = null, intMax: number | null = null, intSec: number | null = null;
    if (gIdx >= 0) {
      grade = texts[gIdx];
      gp = num(texts[gIdx + 1]);
      cr = num(texts[gIdx + 2]);
      cp = num(texts[gIdx + 3]);
      totSec = num(texts[gIdx - 1]);
      totMax = num(texts[gIdx - 3]);
      if (gIdx >= 9) {
        extMax = num(texts[gIdx - 9]);
        extSec = num(texts[gIdx - 7]);
        intMax = num(texts[gIdx - 6]);
        intSec = num(texts[gIdx - 4]);
      }
    } else if (texts.length >= 4) {
      // No grade letter: assume … total max, total min, total secured, grade point, credit, credit points.
      const n = texts.length;
      cp = num(texts[n - 1]);
      cr = num(texts[n - 2]);
      gp = num(texts[n - 3]);
      totSec = num(texts[n - 4]);
      totMax = num(texts[n - 6]);
    }
    if (totMax == null && extMax != null && intMax != null) totMax = extMax + intMax;
    if (totSec == null && extSec != null && intSec != null) totSec = extSec + intSec;
    if (totMax == null && totSec != null && gp != null && gp > 0) {
      const guess = Math.round((totSec / gp) * 10);
      totMax = [50, 100, 150, 200].reduce((b, c) => (Math.abs(c - guess) < Math.abs(b - guess) ? c : b), 100);
    }
    if (result == null && grade) result = grade === 'U' || grade === 'RA' || grade === 'AB' ? 'FAIL' : 'PASS';

    subjects.push({
      code: a.code,
      name,
      extMax, extSecured: extSec, intMax, intSecured: intSec,
      totalMax: totMax, totalSecured: totSec,
      grade, gradePoint: gp, credits: cr, creditPoints: cp, result,
    });
  });

  // Same code twice (e.g. repeated header) → keep the one with more data.
  const byCode = new Map<string, ParsedSubject>();
  for (const s of subjects) {
    const score = (p: ParsedSubject) => [p.totalSecured, p.totalMax, p.credits, p.grade].filter((v) => v != null).length;
    const prev = byCode.get(s.code);
    if (!prev || score(s) > score(prev)) byCode.set(s.code, s);
  }
  const unique = [...byCode.values()];

  const semester = semesterFrom(fullText, fileName, unique.map((s) => s.code));
  const printedSgpa = findNumberNear(lines, /\bSGPA\b/i, lh) ?? numFromRegex(fullText, /\bSGPA\b\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  const printedCgpa = findNumberNear(lines, /\bCGPA\b/i, lh) ?? numFromRegex(fullText, /\bCGPA\b\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);

  for (const s of unique) {
    if (isCounted(s.code) && s.result !== 'FAIL' && (s.totalSecured == null || s.totalMax == null || s.credits == null)) {
      warnings.push(`Couldn't read all the marks for ${s.code}. Please check that row.`);
    }
  }
  if (printedSgpa == null) warnings.push("Couldn't find the printed SGPA on the sheet.");

  return { fileName, studentName, regNo, semester, examMonth, subjects: unique, printedSgpa, printedCgpa, warnings };
}

function numFromRegex(text: string, re: RegExp): number | null {
  const m = re.exec(text);
  return m && Number(m[1]) <= 10 ? Number(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Totals & verification
// ---------------------------------------------------------------------------

export function isPassed(s: ParsedSubject): boolean {
  const r = (s.result ?? '').toUpperCase();
  const g = (s.grade ?? '').toUpperCase();
  if (r === 'FAIL' || r === 'RA' || r === 'AB' || r === 'ABSENT') return false;
  if (g === 'U' || g === 'RA' || g === 'AB') return false;
  return true;
}

export function sheetTotals(subjects: ParsedSubject[]): SemesterTotals {
  return semesterTotals(
    subjects
      .filter((s) => s.totalSecured != null && s.totalMax != null && s.credits != null)
      .map((s) => ({
        code: s.code,
        marks: s.totalSecured as number,
        max: s.totalMax as number,
        credits: s.credits as number,
        counted: isCounted(s.code),
        passed: isPassed(s),
      })),
  );
}

export type Verification = { status: 'verified' | 'mismatch' | 'unknown'; computed: number; printed: number | null };

export function verifySheet(sheet: ParsedSheet): Verification {
  const t = sheetTotals(sheet.subjects);
  if (sheet.printedSgpa == null || t.credits === 0) return { status: 'unknown', computed: t.sgpa, printed: sheet.printedSgpa };
  const ok = Math.abs(roundHalfUp(t.sgpa, 1) - sheet.printedSgpa) < 1e-6;
  return { status: ok ? 'verified' : 'mismatch', computed: t.sgpa, printed: sheet.printedSgpa };
}

// ---------------------------------------------------------------------------
// PDF I/O
// ---------------------------------------------------------------------------

/** Minimal shape of the pdf.js API we use (works with browser and legacy/node builds). */
interface PdfJsLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; useSystemFonts?: boolean; disableFontFace?: boolean }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{
        getTextContent(): Promise<{ items: Array<{ str?: string; transform?: number[]; width?: number; height?: number }> }>;
      }>;
      destroy?: () => Promise<void>;
    }>;
  };
}

export async function extractPdfItems(pdfjs: PdfJsLike, data: Uint8Array): Promise<PositionedText[]> {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true }).promise;
  const out: PositionedText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    for (const it of tc.items) {
      if (!it.str || !it.transform) continue;
      const [, , , d, e, f] = it.transform;
      out.push({ str: it.str, x: e, y: f - (p - 1) * 100000, w: it.width ?? 0, h: it.height || Math.abs(d) || 8 });
    }
  }
  await doc.destroy?.();
  return out;
}

export const isPdfFile = (file: File) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

/** Browser: PDF File → positioned text items. pdf.js is loaded on demand. */
export async function loadPdfItems(file: File): Promise<PositionedText[]> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  try {
    return await extractPdfItems(pdfjs as unknown as PdfJsLike, new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new FriendlyParseError("This PDF wouldn't open. Download it again, or type your marks in.");
  }
}

/** Browser entry point: File → ParsedSheet. pdf.js is loaded on demand. */
export async function parsePdfFile(file: File): Promise<ParsedSheet> {
  if (!isPdfFile(file)) {
    if (file.type.startsWith('image/')) throw new FriendlyParseError('For Sem 1 and 2 we need the DigiLocker PDF. No PDF? Switch to typing your SGPA instead.');
    throw new FriendlyParseError("That isn't a PDF. Upload the Statement of Grade from DigiLocker.");
  }
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  let items: PositionedText[];
  try {
    items = await extractPdfItems(pdfjs as unknown as PdfJsLike, new Uint8Array(await file.arrayBuffer()));
  } catch {
    throw new FriendlyParseError("This PDF couldn't be opened. Download it again from DigiLocker, or enter your marks manually.");
  }
  if (items.length < 5) {
    throw new FriendlyParseError('This PDF has no readable text (it may be a scan). Please enter your marks manually.');
  }
  const sheet = parseItems(items, file.name);
  if (!sheet.subjects.length) {
    throw new FriendlyParseError("No subjects found in this PDF. Make sure it's the DigiLocker Statement of Grade, or enter your marks manually.");
  }
  return sheet;
}
