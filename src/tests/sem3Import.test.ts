import { describe, expect, it } from 'vitest';
import { importSem3, normalizeCode, pickMarks } from '../lib/sem3Import';
import { computeSem3, defaultSem3Input } from '../lib/sem3';
import { SEM3_SUBJECTS } from '../data/subjects';
import { fmt } from '../lib/grading';
import type { PositionedText } from '../lib/pdfParser';

const t = (str: string, x: number, y: number): PositionedText => ({ str, x, y, w: str.length * 6, h: 10 });
const def = (id: string) => SEM3_SUBJECTS.find((s) => s.id === id)!;

/** A college result page row: S.No, code, name, CIA, ESE, total, result. */
function page(rows: Array<[string, string, string, string, string, string]>, withMax = false): PositionedText[] {
  const items: PositionedText[] = [t('Register No : 25BCT040', 20, 900), t('Name : ARJUN K', 300, 900), t('Code', 40, 860), t('Subject', 120, 860), t('CIA', 420, 860), t('ESE', 470, 860), t('Total', 520, 860)];
  rows.forEach(([code, name, cia, ese, total, res], i) => {
    const y = 840 - i * 24;
    items.push(t(String(i + 1), 10, y), t(code, 40, y), t(name, 120, y));
    let x = 420;
    if (withMax) {
      const d = SEM3_SUBJECTS.find((s) => name.toLowerCase().includes(s.short.toLowerCase().split(' ')[0]))!;
      items.push(t(String(d?.ciaMax ?? 20), 380, y));
    }
    for (const v of [cia, ese, total, res]) {
      if (v) items.push(t(v, x, y));
      x += 50;
    }
  });
  return items;
}

const ROWS_040: Array<[string, string, string, string, string, string]> = [
  ['25CSS06A', 'Relational Database Management Systems', '15', '17', '32', 'P'],
  ['25CSS06B', 'Practical: SQL and PL/SQL', '18', '25', '43', 'P'],
  ['25CSS07A', 'Software Engineering', '14', '18', '32', 'P'],
  ['25CSS07B', 'Practical: Software Testing', '20', '29', '49', 'P'],
  ['25CSS08', 'Internet of Things', '12', '16', '28', 'P'],
  ['25CTU02', 'Swarm Intelligence and Distributed AI', '30', '33', '63', 'P'],
  ['25MCU22', 'Operations Research for Computer Studies', '35', '40', '75', 'P'],
  ['25MDC27', 'Food Science and Nutrition in Ayurveda', '60', '', '60', 'P'],
  ['25VAC03', 'Capstone Project', '83', '', '83', 'P'],
];

function toInput(r: ReturnType<typeof importSem3>) {
  const input = defaultSem3Input();
  for (const [id, m] of Object.entries(r.marks)) input.marks[id] = { cia: '', ese: '', total: String(m.total) };
  if (r.electiveCode) input.electiveCode = r.electiveCode;
  if (r.mdcCode) input.mdcCode = r.mdcCode;
  return input;
}

describe('normalizeCode', () => {
  it('fixes OCR digit/letter swaps', () => {
    expect(normalizeCode('25CSSO6A')).toBe('25CSS06A');
    expect(normalizeCode('25C5S07B')).toBe('25CSS07B');
    expect(normalizeCode('2SMCU22')).toBe('25MCU22');
    expect(normalizeCode('25CSS068')).toBe('25CSS06B');
    expect(normalizeCode('25VAC03,')).toBe('25VAC03');
  });
  it('rejects non-codes', () => {
    expect(normalizeCode('Software')).toBeNull();
    expect(normalizeCode('25BCT040')).toBeNull();
    expect(normalizeCode('32')).toBeNull();
  });
});

describe('pickMarks', () => {
  it('finds cia + ese = total and skips the max triple', () => {
    expect(pickMarks([20, 30, 50, 15, 17, 32], def('rdbms'))).toMatchObject({ cia: 15, ese: 17, total: 32, confidence: 'high' });
  });
  it('takes a lone total for CIA-only papers', () => {
    expect(pickMarks([83], def('capstone'))).toMatchObject({ total: 83, confidence: 'high' });
    expect(pickMarks([100, 40, 72], def('mdc'))).toMatchObject({ total: 72 });
  });
});

describe('importSem3 from a result-page table', () => {
  it('reads every subject, the elective and the MDC, and reproduces the SGPA', () => {
    const r = importSem3(page(ROWS_040));
    expect(r.missing).toEqual([]);
    expect(r.marks.rdbms).toMatchObject({ cia: 15, ese: 17, total: 32, confidence: 'high' });
    expect(r.marks.capstone.total).toBe(83);
    expect(r.electiveCode).toBe('25CTU02');
    expect(r.mdcCode).toBe('25MDC27');
    expect(r.regNo).toBe('25BCT040');
    const s = computeSem3(toInput(r));
    expect(fmt(s.totals.sgpa, 2)).toBe('6.78');
    expect(s.percentObtained).toBe(405);
  });

  it('survives OCR mistakes in codes and numbers', () => {
    const noisy = ROWS_040.map(([c, n, a, b, tot, res]) => [c.replace('0', 'O').replace('S', '5'), n, a, b, tot.length === 2 ? `${tot}.` : tot, res] as typeof ROWS_040[number]);
    const r = importSem3(page(noisy));
    expect(r.missing).toEqual([]);
    expect(fmt(computeSem3(toInput(r)).totals.sgpa, 2)).toBe('6.78');
  });

  it('falls back to subject names when the code is unreadable', () => {
    const rows = ROWS_040.map(([, n, a, b, tot, res]) => ['#####', n, a, b, tot, res] as typeof ROWS_040[number]);
    const r = importSem3(page(rows));
    expect(r.missing).toEqual([]);
    expect(r.marks.se.total).toBe(32);
    expect(r.marks.testing.total).toBe(49);
    expect(r.marks.or.confidence).toBe('check');
  });

  it('reports subjects it could not find', () => {
    const r = importSem3(page(ROWS_040.slice(0, 4)));
    expect(r.missing).toEqual(['iot', 'elective', 'or', 'mdc', 'capstone']);
  });
});

describe('importSem3 from a DigiLocker-style Sem 3 statement', () => {
  const COLS = [260, 285, 310, 335, 360, 385, 410, 435, 460, 485, 510, 535, 560, 590];
  const row = (y: number, code: string, name: string, cells: Array<string | number>) => [t('III', 15, y), t(code, 40, y), t(name, 100, y), ...cells.map((c, i) => ({ ...t(String(c), COLS[i], y), w: 12 }))];
  const items = [
    t('Semester : III', 40, 745),
    ...row(700, '25CSS06A', 'RDBMS', [30, 12, 17, 20, 8, 15, 50, 20, 32, 'B+', 6.4, 3, 19.2, 'PASS']),
    ...row(680, '25MCU22', 'Operations Research', [60, 24, 40, 40, 16, 35, 100, 40, 75, 'A', 7.5, 4, 30.0, 'PASS']),
  ];
  it('uses the statement columns', () => {
    const r = importSem3(items);
    expect(r.marks.rdbms).toMatchObject({ total: 32, cia: 15, ese: 17, confidence: 'high' });
    expect(r.marks.or.total).toBe(75);
  });
});

describe('normalizeCode, more OCR slips', () => {
  it('reads 6 for 5 in the year and D/Y/T in digit slots', () => {
    expect(normalizeCode('26CSSOTA')).toBe('25CSS07A');
    expect(normalizeCode('25CTUDY')).toBe('25CTU01');
  });
});
