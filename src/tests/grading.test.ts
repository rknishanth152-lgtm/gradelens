import { describe, expect, it } from 'vitest';
import {
  cgpa,
  fmt,
  gradePoint,
  isCounted,
  passState,
  roundHalfUp,
  semesterTotals,
  targetPlanner,
} from '../lib/grading';
import { computeSem3, defaultSem3Input, type Sem3Input } from '../lib/sem3';
import { computePrev, defaultPrevInput } from '../lib/prevSem';

type Row = [string, number, number, number, number, number, number, number, number, number];

// RDBMS, SQL, SE, Testing, IoT, Elective, OR, MDC, Capstone
const STUDENTS: Array<{
  reg: string;
  marks: Row;
  sem1: [number, number];
  sem2: [number, number];
  sgpa: string;
  cgpa: string;
  total: number;
  pct: string;
}> = [
  { reg: '25BCT040', marks: ['', 32, 43, 32, 49, 28, 63, 75, 60, 83], sem1: [89.8, 12], sem2: [121.0, 15], sgpa: '6.78', cgpa: '7.38', total: 405, pct: '73.64' },
  { reg: '25BCT008', marks: ['', 41, 46, 36, 48, 39, 67, 59, 77, 75], sem1: [70.8, 12], sem2: [105.8, 15], sgpa: '7.35', cgpa: '6.88', total: 411, pct: '74.73' },
  { reg: '25BCT044', marks: ['', 33, 37, 30, 36, 27, 48, 42, 59, 64], sem1: [55.4, 12], sem2: [73.8, 15], sgpa: '5.59', cgpa: '5.12', total: 317, pct: '57.64' },
  { reg: '25BCT006', marks: ['', 44, 45, 41, 35, 44, 81, 78, 70, 67], sem1: [90.4, 12], sem2: [104.3, 15], sgpa: '8.11', cgpa: '7.58', total: 435, pct: '79.09' },
];

const IDS = ['rdbms', 'sql', 'se', 'testing', 'iot', 'elective', 'or', 'mdc', 'capstone'];

function sem3Input(marks: Row, extra: Partial<Sem3Input> = {}): Sem3Input {
  const input = defaultSem3Input();
  IDS.forEach((id, i) => {
    input.marks[id] = { cia: '', ese: '', total: String(marks[i + 1]) };
  });
  return { ...input, ...extra, marks: { ...input.marks, ...(extra.marks ?? {}) } };
}

describe('gradePoint', () => {
  it('scales marks to 10', () => {
    expect(gradePoint(78, 100)).toBe(7.8);
    expect(gradePoint(41, 50)).toBe(8.2);
  });
});

describe('isCounted', () => {
  it('excludes AEC, VAC, ANC', () => {
    expect(isCounted('25AEC21')).toBe(false);
    expect(isCounted('25VAC03')).toBe(false);
    expect(isCounted('25ANC02')).toBe(false);
  });
  it('includes CSS, MCU, CTU, MDC, NPTEL', () => {
    for (const c of ['25CSS06A', '25MCU22', '25CTU01', '25MDC33', 'NPTEL']) expect(isCounted(c)).toBe(true);
  });
});

describe('Sem 3 SGPA, CGPA and percentage (section 9)', () => {
  for (const s of STUDENTS) {
    it(s.reg, () => {
      const r = computeSem3(sem3Input(s.marks));
      expect(r.valid).toBe(true);
      expect(r.totals.credits).toBe(19);
      expect(fmt(r.totals.sgpa, 2)).toBe(s.sgpa);
      expect(r.percentObtained).toBe(s.total);
      expect(r.percentMax).toBe(550);
      expect(fmt(r.percentage, 2)).toBe(s.pct);
      const c = cgpa([
        { creditPoints: s.sem1[0], credits: s.sem1[1] },
        { creditPoints: s.sem2[0], credits: s.sem2[1] },
        r.totals,
      ]);
      expect(fmt(c, 2)).toBe(s.cgpa);
    });
  }

  it('25BCT040 credit points = 128.9', () => {
    const r = computeSem3(sem3Input(STUDENTS[0].marks));
    expect(r.totals.creditPoints).toBeCloseTo(128.9, 6);
  });

  it('NPTEL on, 2 credits, 80/100 for 25BCT040', () => {
    const r = computeSem3(
      sem3Input(STUDENTS[0].marks, { nptelOn: true, marks: { nptel: { cia: '', ese: '', total: '80' } } }),
    );
    expect(r.totals.credits).toBe(21);
    expect(fmt(r.totals.sgpa, 2)).toBe('6.90');
    expect(r.percentObtained).toBe(485);
    expect(r.percentMax).toBe(650);
    expect(fmt(r.percentage, 2)).toBe('74.62');
  });

  it('NPTEL credits are editable', () => {
    const r = computeSem3(
      sem3Input(STUDENTS[0].marks, { nptelOn: true, credits: { nptel: 4 }, marks: { nptel: { cia: '', ese: '', total: '80' } } }),
    );
    expect(r.totals.credits).toBe(23);
    expect(r.totals.creditPoints).toBeCloseTo(128.9 + 32, 6);
  });

  it('CIA + ESE entry adds up to the total', () => {
    const input = sem3Input(STUDENTS[0].marks, { totalOnly: false });
    input.marks.rdbms = { cia: '15', ese: '17', total: '' };
    input.marks.sql = { cia: '18', ese: '25', total: '' };
    input.marks.se = { cia: '14', ese: '18', total: '' };
    input.marks.testing = { cia: '20', ese: '29', total: '' };
    input.marks.iot = { cia: '12', ese: '16', total: '' };
    input.marks.elective = { cia: '30', ese: '33', total: '' };
    input.marks.or = { cia: '35', ese: '40', total: '' };
    const r = computeSem3(input);
    expect(r.valid).toBe(true);
    expect(fmt(r.totals.sgpa, 2)).toBe('6.78');
  });
});

describe('failed subjects', () => {
  it('a failed counted subject is excluded from numerator and denominator', () => {
    const t = semesterTotals([
      { code: '25CSS06A', marks: 40, max: 50, credits: 3, counted: true, passed: true },
      { code: '25MCU22', marks: 20, max: 100, credits: 4, counted: true, passed: false },
    ]);
    expect(t.credits).toBe(3);
    expect(t.creditPoints).toBeCloseTo(24, 6);
    expect(t.sgpa).toBeCloseTo(8, 6);
  });

  it('a total below 40% fails in the Sem 3 form', () => {
    const marks = [...STUDENTS[0].marks] as Row;
    marks[7] = 30; // OR 30/100 → fail
    const r = computeSem3(sem3Input(marks));
    const or = r.rows.find((x) => x.def.id === 'or')!;
    expect(or.state).toBe('fail');
    expect(r.totals.credits).toBe(15);
    expect(r.totals.creditPoints).toBeCloseTo(128.9 - 30, 6);
  });

  it('ESE below 40% fails even when the total passes', () => {
    expect(passState({ total: 30, totalMax: 50, ese: 11, eseMax: 30 })).toBe('fail');
    expect(passState({ total: 30, totalMax: 50, ese: 12, eseMax: 30 })).toBe('borderline');
    expect(passState({ total: 20, totalMax: 50 })).toBe('borderline');
    expect(passState({ total: 21, totalMax: 50 })).toBe('pass');
  });
});

describe('roundHalfUp', () => {
  it('handles float edge cases', () => {
    expect(roundHalfUp(7.05, 1)).toBe(7.1);
    expect(roundHalfUp(7.95, 1)).toBe(8.0);
    expect(roundHalfUp(1.005, 2)).toBe(1.01);
    expect(roundHalfUp(6.784, 2)).toBe(6.78);
    expect(roundHalfUp(89.8 / 12, 1)).toBe(7.5);
    expect(fmt(7.95, 1)).toBe('8.0');
  });

  it('reproduces the official history (section 2.4)', () => {
    const hist: Array<[number, number, number, number, number, number]> = [
      [89.8, 12, 7.5, 121.0, 15, 8.1],
      [70.8, 12, 5.9, 105.8, 15, 7.1],
      [55.4, 12, 4.6, 73.8, 15, 4.9],
      [90.4, 12, 7.5, 104.3, 15, 7.0],
    ];
    const cg = [7.8, 6.5, 4.8, 7.2];
    hist.forEach(([cp1, c1, s1, cp2, c2, s2], i) => {
      expect(roundHalfUp(cp1 / c1, 1)).toBe(s1);
      expect(roundHalfUp(cp2 / c2, 1)).toBe(s2);
      expect(roundHalfUp(cgpa([{ creditPoints: cp1, credits: c1 }, { creditPoints: cp2, credits: c2 }]), 1)).toBe(cg[i]);
    });
  });
});

describe('targetPlanner', () => {
  it('25BCT008 needs ≈ 8.91 for an 8.0 CGPA', () => {
    const p = targetPlanner({ currentCP: 316.3, currentCredits: 46, target: 8, remainingSems: 3, creditsPerSem: 19 });
    expect(p.final.sem).toBe(6);
    expect(fmt(p.final.required, 2)).toBe('8.91');
    expect(p.final.reachable).toBe(true);
    expect(p.horizons).toHaveLength(3);
  });

  it('25BCT044 cannot reach 8.0; max ≈ 7.82', () => {
    const p = targetPlanner({ currentCP: 235.4, currentCredits: 46, target: 8, remainingSems: 3, creditsPerSem: 19 });
    expect(p.final.reachable).toBe(false);
    expect(fmt(p.final.maxAchievable, 2)).toBe('7.82');
  });
});

describe('previous semesters, manual entry', () => {
  it('quick mode converts SGPA with default credits', () => {
    const r = computePrev(1, { ...defaultPrevInput(1), method: 'manual', quickSgpa: '7.5' });
    expect(r.valid).toBe(true);
    expect(r.credits).toBe(12);
    expect(r.creditPoints).toBeCloseTo(90, 6);
  });

  it('detailed mode computes counted credits', () => {
    const r = computePrev(2, {
      ...defaultPrevInput(2),
      method: 'manual',
      manualMode: 'detailed',
      detailed: { java: '80', javaLab: '90', os: '75', maths2: '70', mdc2: '85' },
    });
    expect(r.valid).toBe(true);
    expect(r.credits).toBe(15);
    expect(r.creditPoints).toBeCloseTo(32 + 9 + 30 + 28 + 17, 6);
  });

  it('quick mode rejects SGPA above 10', () => {
    const r = computePrev(1, { ...defaultPrevInput(1), method: 'manual', quickSgpa: '11' });
    expect(r.valid).toBe(false);
  });
});
