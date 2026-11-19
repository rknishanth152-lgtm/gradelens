import { DEFAULT_PREV_CREDITS, PREV_SUBJECTS } from '../data/subjects';
import { isCounted, passState, semesterTotals, type SemesterTotals } from './grading';
import { parseMark } from './sem3';
import { isPassed, sheetTotals, verifySheet, type ParsedSheet, type Verification } from './pdfParser';

export type SemNo = 1 | 2;

export interface PrevSemInput {
  method: 'pdf' | 'manual';
  manualMode: 'quick' | 'detailed';
  quickSgpa: string;
  /** Counted credits used to turn a quick SGPA into credit points. */
  quickCredits: number;
  detailed: Record<string, string>;
  detailedCredits: Record<string, number>;
  sheet: ParsedSheet | null;
}

export function defaultPrevInput(sem: SemNo): PrevSemInput {
  return {
    method: 'pdf',
    manualMode: 'quick',
    quickSgpa: '',
    quickCredits: DEFAULT_PREV_CREDITS[sem],
    detailed: {},
    detailedCredits: {},
    sheet: null,
  };
}

export interface PrevSemResult extends SemesterTotals {
  valid: boolean;
  source: 'pdf' | 'quick' | 'detailed';
  verification?: Verification;
  error?: string;
  missing?: number;
}

export function parseSgpa(raw: string): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (!s) return { value: null, error: null };
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return { value: null, error: 'Enter a number like 7.5' };
  const v = Number(s);
  if (v > 10) return { value: null, error: 'SGPA is out of 10' };
  return { value: v, error: null };
}

export function computePrev(sem: SemNo, input: PrevSemInput): PrevSemResult {
  if (input.method === 'pdf') {
    if (!input.sheet) return { valid: false, source: 'pdf', creditPoints: 0, credits: 0, sgpa: 0 };
    const t = sheetTotals(input.sheet.subjects);
    const incomplete = input.sheet.subjects.some(
      (s) => isCounted(s.code) && isPassed(s) && (s.totalSecured == null || s.totalMax == null || s.credits == null || s.totalSecured > s.totalMax),
    );
    return { ...t, valid: t.credits > 0 && !incomplete, source: 'pdf', verification: verifySheet(input.sheet) };
  }
  if (input.manualMode === 'quick') {
    const { value, error } = parseSgpa(input.quickSgpa);
    const credits = input.quickCredits > 0 ? input.quickCredits : DEFAULT_PREV_CREDITS[sem];
    if (value == null) return { valid: false, source: 'quick', creditPoints: 0, credits, sgpa: 0, error: error ?? undefined };
    return { valid: true, source: 'quick', creditPoints: value * credits, credits, sgpa: value };
  }
  // Detailed
  const defs = PREV_SUBJECTS[sem].filter((s) => s.counted);
  let missing = 0;
  let bad = false;
  const graded = defs.flatMap((d) => {
    const { value, error } = parseMark(input.detailed[d.id] ?? '', d.totalMax);
    if (error) bad = true;
    if (value == null) {
      if (!error) missing++;
      return [];
    }
    const st = passState({ total: value, totalMax: d.totalMax });
    const credits = input.detailedCredits[d.id] ?? d.credits;
    return [{ code: d.code, marks: value, max: d.totalMax, credits, counted: true, passed: st !== 'fail' }];
  });
  const t = semesterTotals(graded);
  return { ...t, valid: !bad && missing === 0, source: 'detailed', missing };
}
