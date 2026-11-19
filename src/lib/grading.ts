/**
 * GradeLens grading rules for SKASC B.Sc. Computer Technology (2025–28).
 * All functions here are pure and unit-tested (src/tests/grading.test.ts).
 */

/** Grade point on a 10-point scale: 78/100 → 7.8, 41/50 → 8.2. */
export function gradePoint(marks: number, max: number): number {
  if (!(max > 0) || !Number.isFinite(marks)) return 0;
  const clamped = Math.min(Math.max(marks, 0), max);
  // Round to 4 decimals to keep float noise out (41/50*10 = 8.200000000000001).
  return Math.round((clamped / max) * 10 * 1e4) / 1e4;
}

/** Category letters in a code such as 25CSS06A → "CSS". */
export function codeCategory(code: string): string | null {
  const m = /^\d{2}([A-Z]{3})\d{2}/.exec(code.trim().toUpperCase());
  return m ? m[1] : null;
}

// Counted categories for this programme. Everything else (AEC languages, VAC, ANC non-credit,
// and 'additional credit' courses such as HMU) is left out of SGPA/CGPA, as on the official sheets.
const COUNTED = new Set(['CSS', 'MCU', 'CTU', 'MDC']);

/**
 * Whether a subject counts towards SGPA/CGPA.
 * Languages/English (AEC), value-added (VAC) and non-credit (ANC) papers are excluded.
 * Anything else (CSS, MCU, CTU, MDC, NPTEL…) counts.
 */
export function isCounted(code: string): boolean {
  if (/^NPTEL/i.test(code.trim())) return true;
  const cat = codeCategory(code);
  if (!cat) return true;
  return COUNTED.has(cat);
}

export interface GradedSubject {
  code: string;
  name?: string;
  marks: number;
  max: number;
  credits: number;
  counted: boolean;
  passed: boolean;
}

export interface SemesterTotals {
  creditPoints: number;
  credits: number;
  /** Precise SGPA (unrounded). 0 when no credits. */
  sgpa: number;
}

/** Credit points earned by one subject (0 if not counted or failed). */
export function subjectCreditPoints(s: GradedSubject): number {
  if (!s.counted || !s.passed) return 0;
  return gradePoint(s.marks, s.max) * s.credits;
}

/** SGPA = Σ creditPoints / Σ credits over counted, passed subjects. */
export function semesterTotals(subjects: GradedSubject[]): SemesterTotals {
  let cp = 0;
  let cr = 0;
  for (const s of subjects) {
    if (!s.counted || !s.passed || !(s.credits > 0)) continue;
    cp += gradePoint(s.marks, s.max) * s.credits;
    cr += s.credits;
  }
  cp = Math.round(cp * 1e4) / 1e4;
  return { creditPoints: cp, credits: cr, sgpa: cr > 0 ? cp / cr : 0 };
}

export function sgpa(subjects: GradedSubject[]): number {
  return semesterTotals(subjects).sgpa;
}

/** Credit-weighted CGPA across semesters (NOT an average of SGPAs). */
export function cgpa(semesters: Array<Pick<SemesterTotals, 'creditPoints' | 'credits'>>): number {
  let cp = 0;
  let cr = 0;
  for (const s of semesters) {
    cp += s.creditPoints;
    cr += s.credits;
  }
  return cr > 0 ? cp / cr : 0;
}

/** Percentage = obtained / max × 100. */
export function percentage(obtained: number, max: number): number {
  return max > 0 ? (obtained / max) * 100 : 0;
}

/**
 * Round half-up to `digits` decimals, robust against float error
 * (7.05 → 7.1, 7.95 → 8.0, 6.785 → 6.79).
 */
export function roundHalfUp(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const p = 10 ** digits;
  // The epsilon absorbs binary float error such as 7.05 → 7.04999999…
  const rounded = Math.floor(abs * p + 0.5 + 1e-9) / p;
  return sign * rounded;
}

/** Fixed-decimal display string using half-up rounding. */
export function fmt(value: number, digits = 2): string {
  return roundHalfUp(value, digits).toFixed(digits);
}

// ---------------------------------------------------------------------------
// Pass / fail
// ---------------------------------------------------------------------------

export type PassState = 'pass' | 'borderline' | 'fail' | 'empty';

/**
 * A pass needs ESE ≥ 40% of ESE max (when ESE is known) and Total ≥ 40% of total max.
 * "borderline" = passes, but exactly at a minimum.
 */
export function passState(args: {
  total: number | null;
  totalMax: number;
  ese?: number | null;
  eseMax?: number;
}): PassState {
  const { total, totalMax, ese, eseMax } = args;
  if (total == null || !Number.isFinite(total)) return 'empty';
  const totalMin = roundHalfUp(totalMax * 0.4, 4);
  if (total < totalMin) return 'fail';
  let borderline = total === totalMin;
  if (ese != null && Number.isFinite(ese) && eseMax && eseMax > 0) {
    const eseMin = roundHalfUp(eseMax * 0.4, 4);
    if (ese < eseMin) return 'fail';
    if (ese === eseMin) borderline = true;
  }
  return borderline ? 'borderline' : 'pass';
}

// ---------------------------------------------------------------------------
// Target planner
// ---------------------------------------------------------------------------

export interface TargetHorizon {
  /** Semester number the target is evaluated at (e.g. 4, 5, 6). */
  sem: number;
  remainingCredits: number;
  /** Average SGPA needed across the remaining semesters up to `sem`. */
  required: number;
  reachable: boolean;
  /** Best CGPA possible at `sem` if every remaining SGPA is 10. */
  maxAchievable: number;
}

export interface TargetPlan {
  target: number;
  currentCgpa: number;
  horizons: TargetHorizon[];
  /** Final horizon (end of Sem 6). */
  final: TargetHorizon;
}

/**
 * required = (target × totalCreditsAtEnd − currentCP) / remainingCredits
 */
export function targetPlanner(args: {
  currentCP: number;
  currentCredits: number;
  target: number;
  remainingSems: number;
  creditsPerSem: number;
  completedSems?: number;
}): TargetPlan {
  const { currentCP, currentCredits, target, remainingSems, creditsPerSem } = args;
  const done = args.completedSems ?? 3;
  const horizons: TargetHorizon[] = [];
  for (let k = 1; k <= remainingSems; k++) {
    const remainingCredits = creditsPerSem * k;
    const totalAtEnd = currentCredits + remainingCredits;
    const required = remainingCredits > 0 ? (target * totalAtEnd - currentCP) / remainingCredits : Infinity;
    const maxAchievable = totalAtEnd > 0 ? (currentCP + 10 * remainingCredits) / totalAtEnd : 0;
    horizons.push({
      sem: done + k,
      remainingCredits,
      required,
      reachable: required <= 10 + 1e-9,
      maxAchievable,
    });
  }
  const currentCgpa = currentCredits > 0 ? currentCP / currentCredits : 0;
  const final =
    horizons[horizons.length - 1] ??
    ({ sem: done, remainingCredits: 0, required: Infinity, reachable: currentCgpa >= target, maxAchievable: currentCgpa } as TargetHorizon);
  return { target, currentCgpa, horizons, final };
}
