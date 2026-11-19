/**
 * Sem 3 marks from a PDF or a photo of the result page.
 *
 * Works on positioned text (pdf.js items or OCR words), so the same logic serves both.
 * Every value it finds is a suggestion: the UI drops it into the marks form and asks the
 * student to check it against their sheet.
 */
import { ELECTIVE_OPTIONS, MDC_OPTIONS, PREV_SUBJECTS, SEM3_SUBJECTS, type Sem3Subject } from '../data/subjects';
import { groupLines, parseItems, type PositionedText } from './pdfParser';

export type Confidence = 'high' | 'check';

export interface ImportedMark {
  cia: number | null;
  ese: number | null;
  total: number;
  confidence: Confidence;
}

export interface Sem3ImportResult {
  marks: Record<string, ImportedMark>;
  electiveCode: string | null;
  mdcCode: string | null;
  regNo: string | null;
  studentName: string | null;
  /** Subject ids we couldn't find. */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Code normalisation (OCR mixes up O/0, I/1, S/5, B/8 …)
// ---------------------------------------------------------------------------

const TO_DIGIT: Record<string, string> = { O: '0', o: '0', D: '0', Q: '0', U: '0', I: '1', l: '1', i: '1', '|': '1', L: '1', Y: '1', J: '1', Z: '2', z: '2', S: '5', s: '5', G: '6', B: '8', T: '7' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G', '4': 'A' };

/** Try to read a token as a 25XXX00[A|B] subject code, fixing common OCR confusions. */
export function normalizeCode(raw: string): string | null {
  const t = raw.replace(/[^A-Za-z0-9|]/g, '');
  if (t.length < 7 || t.length > 9) return null;
  const chars = t.split('');
  const digit = (c: string) => (/\d/.test(c) ? c : TO_DIGIT[c] ?? null);
  const letter = (c: string) => (/[A-Za-z]/.test(c) ? c.toUpperCase() : TO_LETTER[c] ?? null);
  const out: string[] = [];
  const pattern = ['d', 'd', 'l', 'l', 'l', 'd', 'd'];
  for (let i = 0; i < 7; i++) {
    const c = pattern[i] === 'd' ? digit(chars[i]) : letter(chars[i]);
    if (!c) return null;
    out.push(c);
  }
  // The year prefix is always 25; OCR often reads the 5 as 6.
  if (out[0] !== '2' || (out[1] !== '5' && out[1] !== '6')) return null;
  out[1] = '5';
  if (t.length >= 8) {
    const suf = letter(chars[7]);
    if (suf === 'A' || suf === 'B') out.push(suf);
    else if (t.length === 8) return null;
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Which subject a line belongs to
// ---------------------------------------------------------------------------

export interface Target {
  id: string;
  def: Sem3Subject;
  codes: RegExp;
  words: RegExp;
}

export const TARGETS: Target[] = SEM3_SUBJECTS.map((def) => {
  const map: Record<string, [RegExp, RegExp]> = {
    rdbms: [/^25CSS06A$/, /relational|database|\brdbms\b/i],
    sql: [/^25CSS06B$/, /sql/i],
    se: [/^25CSS07A$/, /engin/i],
    testing: [/^25CSS07B$/, /testing/i],
    iot: [/^25CSS08$/, /internet|\bthings\b|\biot\b/i],
    elective: [/^25CTU0[12]$/, /extended|reality|interactive|swarm|distributed|intelligence/i],
    or: [/^25MCU22$/, /operations?|research/i],
    mdc: [/^25MDC\d\d$/, /bharathiya|principles|food\s*science|ayurveda|nutrition|frontiers|business\s*models/i],
    capstone: [/^25VAC03$/, /capstone/i],
  };
  const [codes, words] = map[def.id];
  return { id: def.id, def, codes, words };
});

export const NUM_RE = /^\d{1,3}(?:\.\d{1,2})?$/;

/** Clean an OCR'd number token: "32." → 32, "4O" → 40. Returns null if not a number. */
export function toNumber(tok: string): number | null {
  let t = tok.replace(/[.,:;|)]+$/, '').replace(/^[(|]+/, '');
  if (/^[0-9OoIlSB]{1,3}$/.test(t) && /\d/.test(t)) t = t.replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/S/g, '5').replace(/B/g, '8');
  return NUM_RE.test(t) ? Number(t) : null;
}

/** Pick CIA / ESE / total from a row of numbers. */
export function pickMarks(nums: number[], def: Sem3Subject): ImportedMark | null {
  const { ciaMax, eseMax, totalMax } = def;
  const isMaxTriple = (a: number, b: number, c: number) => a === ciaMax && b === eseMax && c === totalMax;

  if (eseMax > 0) {
    // Look for cia + ese = total (in either order); prefer the last match (secured comes after max).
    let best: ImportedMark | null = null;
    for (let i = 0; i + 2 < nums.length; i++) {
      const [a, b, c] = [nums[i], nums[i + 1], nums[i + 2]];
      if (Math.abs(a + b - c) > 0.01 || c > totalMax) continue;
      if (isMaxTriple(a, b, c)) continue;
      const conf = c >= totalMax * 0.3 ? 'high' : 'check';
      if (a <= ciaMax && b <= eseMax) best = { cia: a, ese: b, total: c, confidence: conf };
      else if (a <= eseMax && b <= ciaMax) best = { cia: b, ese: a, total: c, confidence: conf };
    }
    if (best) return best;
    // CIA and ESE side by side without a total.
    for (let i = nums.length - 2; i >= 0; i--) {
      const [a, b] = [nums[i], nums[i + 1]];
      if (a <= ciaMax && b <= eseMax && !(a === ciaMax && b === eseMax)) {
        // Only trust this if the next number isn't a plausible total that disagrees.
        if (a + b <= totalMax) return { cia: a, ese: b, total: a + b, confidence: 'check' };
      }
    }
  }

  // Single total: drop maxes and pass minimums when there are other candidates.
  const minMark = totalMax * 0.4;
  let cands = nums.filter((n) => n <= totalMax);
  const filtered = cands.filter((n) => n !== totalMax && n !== minMark && n !== ciaMax && n !== eseMax);
  if (filtered.length) cands = filtered;
  if (!cands.length) return null;
  // The total is the biggest of CIA / ESE / total, so a stray small number never wins.
  const total = Math.max(...cands);
  const allSame = nums.length > 0 && nums.every((n) => n === total);
  return { cia: null, ese: null, total, confidence: eseMax === 0 && allSame && total >= totalMax * 0.3 ? 'high' : 'check' };
}

/** Main entry: positioned text → Sem 3 marks. */
export function importSem3(items: PositionedText[], targets: Target[] = TARGETS): Sem3ImportResult {
  const result: Sem3ImportResult = { marks: {}, electiveCode: null, mdcCode: null, regNo: null, studentName: null, missing: [] };

  // 1) DigiLocker-style statement: reuse the full parser when it finds Sem 3 codes with totals.
  const sheet = parseItems(items);
  result.regNo = sheet.regNo;
  result.studentName = sheet.studentName;
  for (const s of sheet.subjects) {
    const target = targets.find((t) => t.codes.test(s.code));
    if (!target || s.totalSecured == null || result.marks[target.id]) continue;
    // Only trust rows that really have the full statement layout.
    if (s.totalMax !== target.def.totalMax || s.gradePoint == null || s.credits == null || !s.grade) continue;
    if (s.totalSecured > s.totalMax) continue;
    if (target.id === 'elective') result.electiveCode = s.code;
    if (target.id === 'mdc') result.mdcCode = MDC_OPTIONS.some((o) => o.code === s.code) ? s.code : '25MDCxx';
    result.marks[target.id] = { cia: s.intSecured, ese: s.extSecured, total: s.totalSecured, confidence: 'high' };
  }

  // 2) Generic table (college result page, screenshot or photo): one subject per line.
  const lines = groupLines(items);
  const used = new Set<number>();
  for (const target of targets) {
    if (result.marks[target.id]) continue;
    for (let li = 0; li < lines.length; li++) {
      if (used.has(li)) continue;
      const tokens = lines[li].text.split(/\s+/);
      let codeHit: string | null = null;
      let codeIdx = -1;
      for (let i = 0; i < tokens.length; i++) {
        const c = normalizeCode(tokens[i]);
        if (c && target.codes.test(c)) {
          codeHit = c;
          codeIdx = i;
          break;
        }
      }
      const nameHit = codeIdx < 0 && target.words.test(lines[li].text);
      if (codeIdx < 0 && !nameHit) continue;
      // Avoid "Software Engineering" grabbing the testing row and vice versa.
      if (!codeHit && target.id === 'testing' && /engineering/i.test(lines[li].text)) continue;
      if (!codeHit && target.id === 'se' && /testing/i.test(lines[li].text)) continue;

      // Numbers after the code (or anywhere on the line when matched by name).
      const after = codeIdx >= 0 ? tokens.slice(codeIdx + 1) : tokens;
      let nums = after.map(toNumber).filter((n): n is number => n != null);
      // Wrapped names: numbers may sit on the next line.
      if (nums.length === 0 && lines[li + 1]) {
        nums = lines[li + 1].text.split(/\s+/).map(toNumber).filter((n): n is number => n != null);
      }
      const picked = pickMarks(nums, target.def);
      if (!picked) continue;
      used.add(li);
      result.marks[target.id] = codeHit ? picked : { ...picked, confidence: 'check' };
      if (target.id === 'elective') {
        result.electiveCode = codeHit ?? (/swarm|distributed/i.test(lines[li].text) ? ELECTIVE_OPTIONS[1].code : ELECTIVE_OPTIONS[0].code);
      }
      if (target.id === 'mdc') {
        const code: string | null = codeHit;
        result.mdcCode = code && MDC_OPTIONS.some((o) => o.code === code) ? code : /food|ayurveda/i.test(lines[li].text) ? '25MDC27' : /bharathiya|management/i.test(lines[li].text) ? '25MDC33' : '25MDCxx';
      }
      break;
    }
  }

  result.missing = targets.map((t) => t.id).filter((id) => !result.marks[id]);
  return result;
}

// ---------------------------------------------------------------------------
// Fuzzy code matching: snap a misread code to the closest real one
// ---------------------------------------------------------------------------

export const KNOWN_SEM3_CODES = ['25CSS06A', '25CSS06B', '25CSS07A', '25CSS07B', '25CSS08', '25CTU01', '25CTU02', '25MCU22', '25MDC33', '25MDC27', '25VAC03', '25ANC01', '25ANC02'];

/** Map look-alike characters to one canonical form so O/0, S/5, B/8… compare equal. */
const canon = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[OQD]/g, '0')
    .replace(/[IL|J]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8')
    .replace(/Z/g, '2')
    .replace(/G/g, '6')
    .replace(/T/g, '7');

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/**
 * Closest known code to an OCR token, or null if nothing is close enough / it's ambiguous.
 * "25CSSO00A" → 25CSS06A, "250SS00B" → 25CSS06B.
 */
export function matchCode(token: string, known: string[] = KNOWN_SEM3_CODES): string | null {
  const exact = normalizeCode(token);
  if (exact && known.includes(exact)) return exact;
  // MDC papers are many and change yearly: any well-formed 25MDCnn code is real.
  if (exact && /^25MDC\d\d$/.test(exact)) return exact;
  const t = canon(token);
  if (t.length < 6 || t.length > 10 || !/^2/.test(t)) return null;
  const scored = known.map((k) => ({ k, d: editDistance(t, canon(k)) })).sort((a, b) => a.d - b.d);
  const [best, second] = scored;
  if (best.d > 2) return null;
  if (second && second.d === best.d) {
    // Tie between A/B variants: decide on the last character.
    const last = token.trim().toUpperCase().slice(-1);
    const pick = scored.filter((s) => s.d === best.d).find((s) => s.k.endsWith(last === '8' ? 'B' : last));
    return pick ? pick.k : null;
  }
  return best.k;
}


// ---------------------------------------------------------------------------
// Sem 1 / Sem 2 result pages (same CIA / ESE / TOTAL layout)
// ---------------------------------------------------------------------------

const PREV_RULES: Record<string, [RegExp, RegExp, number, number]> = {
  // id: [code, name words, ciaMax, eseMax]
  cpp: [/^25CSS01A$/, /^(?!.*practical).*(object\s*oriented|oop)/i, 20, 30],
  cppLab: [/^25CSS01B$/, /practical.*(object|oop|c\+\+)/i, 20, 30],
  dsa: [/^25CSS02$/, /data\s*struct|algorithm/i, 40, 60],
  maths1: [/^25MCU06$/, /mathematical|foundation/i, 40, 60],
  java: [/^25CSS03$/, /^(?!.*practical).*java/i, 40, 60],
  javaLab: [/^25CSS04$/, /practical.*java/i, 40, 60],
  os: [/^25CSS05$/, /operating/i, 40, 60],
  maths2: [/^25MCU14$/, /numerical|statistics/i, 40, 60],
  mdc2: [/^25MDC\d\d$/, /mutual|export|managerial|business|competenc/i, 100, 0],
};

export const KNOWN_PREV_CODES: Record<1 | 2, string[]> = {
  1: ['25CSS01A', '25CSS01B', '25CSS02', '25MCU06', '25AEC21', '25AEC09', '25AEC11', '25VAC01'],
  2: ['25CSS03', '25CSS04', '25CSS05', '25MCU14', '25MDC15', '25AEC12', '25AEC23', '25AEC10', '25VAC02'],
};

/** Counted Sem 1 / Sem 2 subjects as read targets. */
export function prevTargets(sem: 1 | 2): Target[] {
  return PREV_SUBJECTS[sem]
    .filter((s) => s.counted)
    .map((s) => {
      const [codes, words, ciaMax, eseMax] = PREV_RULES[s.id];
      const def: Sem3Subject = { id: s.id, code: s.code, name: s.name, short: s.name, ciaMax, eseMax, totalMax: s.totalMax, credits: s.credits, counted: true, inPercentage: false };
      return { id: s.id, def, codes, words };
    });
}
