import {
  NPTEL_SUBJECT,
  SEM3_PERCENT_MAX,
  SEM3_PERCENT_MAX_NPTEL,
  SEM3_SUBJECTS,
  type Sem3Subject,
} from '../data/subjects';
import {
  gradePoint,
  passState,
  percentage,
  semesterTotals,
  type GradedSubject,
  type PassState,
  type SemesterTotals,
} from './grading';

export interface MarkInput {
  cia: string;
  ese: string;
  total: string;
}

export interface Sem3Input {
  /** When true, the student types only the TOTAL column. */
  totalOnly: boolean;
  marks: Record<string, MarkInput>;
  electiveCode: string;
  mdcCode: string;
  mdcOtherName: string;
  nptelOn: boolean;
  nptelName: string;
  /** Credit overrides by subject id. */
  credits: Record<string, number>;
  /** Spoken Hindi / Basic Tamil (non-credit) — purely informational. */
  ancPassed: boolean | null;
}

export const emptyMark = (): MarkInput => ({ cia: '', ese: '', total: '' });

export function defaultSem3Input(): Sem3Input {
  return {
    totalOnly: true,
    marks: {},
    electiveCode: '25CTU01',
    mdcCode: '25MDC33',
    mdcOtherName: '',
    nptelOn: false,
    nptelName: '',
    credits: {},
    ancPassed: null,
  };
}

/** Parse a marks field. '' → null, invalid → error message. */
export function parseMark(raw: string, max: number): { value: number | null; error: string | null } {
  const s = raw.trim();
  if (s === '') return { value: null, error: null };
  if (s.startsWith('-')) return { value: null, error: "Marks can't be negative" };
  if (!/^\d+(\.\d+)?$/.test(s)) return { value: null, error: 'Numbers only' };
  const v = Number(s);
  if (v > max) return { value: null, error: `Max is ${max}` };
  return { value: v, error: null };
}

export interface Sem3Row {
  def: Sem3Subject;
  code: string;
  name: string;
  total: number | null;
  ese: number | null;
  state: PassState;
  gradePoint: number;
  credits: number;
  creditPoints: number;
  counted: boolean;
  errors: { cia?: string; ese?: string; total?: string };
  complete: boolean;
}

export interface Sem3Result {
  rows: Sem3Row[];
  valid: boolean;
  missing: number;
  totals: SemesterTotals;
  percentObtained: number;
  percentMax: number;
  percentage: number;
}

export function activeSubjects(input: Sem3Input): Sem3Subject[] {
  const list = SEM3_SUBJECTS.map((s) => {
    if (s.id === 'elective') {
      const opt = s.options!.find((o) => o.code === input.electiveCode) ?? s.options![0];
      return { ...s, code: opt.code, name: opt.name };
    }
    if (s.id === 'mdc') {
      const opt = s.options!.find((o) => o.code === input.mdcCode) ?? s.options![0];
      const name = opt.name === 'Other' ? input.mdcOtherName.trim() || 'MDC (other)' : opt.name;
      return { ...s, code: opt.code, name };
    }
    return s;
  });
  if (input.nptelOn) {
    list.push({ ...NPTEL_SUBJECT, name: input.nptelName.trim() || NPTEL_SUBJECT.name });
  }
  return list;
}

export function creditsFor(def: Sem3Subject, input: Sem3Input): number {
  const o = input.credits[def.id];
  return typeof o === 'number' && Number.isFinite(o) && o >= 0 ? o : def.credits;
}

/** True when this subject only has one marks box (CIA-only or NPTEL, or total-only mode). */
export function usesSingleField(def: Sem3Subject, totalOnly: boolean): boolean {
  return totalOnly || def.eseMax === 0 || def.ciaMax === 0;
}

export function computeSem3(input: Sem3Input): Sem3Result {
  const defs = activeSubjects(input);
  let missing = 0;
  let anyError = false;
  const rows: Sem3Row[] = defs.map((def) => {
    const m = input.marks[def.id] ?? emptyMark();
    const errors: Sem3Row['errors'] = {};
    let total: number | null = null;
    let ese: number | null = null;
    let complete = false;

    if (usesSingleField(def, input.totalOnly)) {
      const t = parseMark(m.total, def.totalMax);
      if (t.error) errors.total = t.error;
      total = t.value;
      complete = t.value != null;
    } else {
      const c = parseMark(m.cia, def.ciaMax);
      const e = parseMark(m.ese, def.eseMax);
      if (c.error) errors.cia = c.error;
      if (e.error) errors.ese = e.error;
      ese = e.value;
      if (c.value != null && e.value != null) {
        total = Math.round((c.value + e.value) * 100) / 100;
        complete = true;
      }
    }
    if (Object.keys(errors).length) anyError = true;
    else if (!complete) missing++;

    const state = passState({ total, totalMax: def.totalMax, ese, eseMax: def.eseMax });
    const credits = creditsFor(def, input);
    const gp = total != null ? gradePoint(total, def.totalMax) : 0;
    const passed = state === 'pass' || state === 'borderline';
    const counted = def.counted;
    return {
      def,
      code: def.code,
      name: def.name,
      total,
      ese,
      state,
      gradePoint: gp,
      credits,
      creditPoints: counted && passed ? Math.round(gp * credits * 1e4) / 1e4 : 0,
      counted,
      errors,
      complete,
    };
  });

  const graded: GradedSubject[] = rows
    .filter((r) => r.total != null)
    .map((r) => ({
      code: r.code,
      marks: r.total as number,
      max: r.def.totalMax,
      credits: r.credits,
      counted: r.counted,
      passed: r.state === 'pass' || r.state === 'borderline',
    }));
  const totals = semesterTotals(graded);

  const percentRows = rows.filter((r) => r.def.inPercentage);
  const percentObtained = percentRows.reduce((a, r) => a + (r.total ?? 0), 0);
  const percentMax = input.nptelOn ? SEM3_PERCENT_MAX_NPTEL : SEM3_PERCENT_MAX;

  return {
    rows,
    valid: !anyError && missing === 0,
    missing,
    totals,
    percentObtained,
    percentMax,
    percentage: percentage(percentObtained, percentMax),
  };
}
