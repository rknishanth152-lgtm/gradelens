import { describe, expect, it } from 'vitest';
import { groupLines, parseItems, sheetTotals, verifySheet, type PositionedText } from '../lib/pdfParser';
import { roundHalfUp } from '../lib/grading';

const t = (str: string, x: number, y: number): PositionedText => ({ str, x, y, w: str.length * 4.2, h: 8 });

// Column x positions, mimicking the Statement of Grade table.
const COLS = [260, 285, 310, 335, 360, 385, 410, 435, 460, 485, 510, 535, 560, 590];

function row(y: number, code: string, name: string | string[], cells: Array<string | number>, sem = 'I'): PositionedText[] {
  const out = [t(sem, 15, y), t(code, 40, y)];
  const names = Array.isArray(name) ? name : [name];
  names.forEach((n, i) => out.push(t(n, 100, y - i * 8)));
  cells.forEach((c, i) => out.push(t(String(c), COLS[i] + (i === 9 ? 1 : 0), y + (i % 2 ? 0.4 : -0.3))));
  return out;
}

function header(sem: string, sgpa: string, cgpa: string): PositionedText[] {
  return [
    t('SRI KRISHNA ARTS AND SCIENCE COLLEGE', 150, 800),
    t('STATEMENT OF GRADE', 200, 785),
    t('Name : ARJUN K', 40, 760),
    t('Reg. No : 25BCT040', 330, 760),
    t(`Semester : ${sem}`, 40, 745),
    t('NOVEMBER 2025', 330, 745),
    t('Sem', 15, 720), t('Course Code', 40, 720), t('Course Title', 100, 720),
    t('EXT', 285, 728), t('INT', 360, 728), t('TOTAL', 435, 728),
    t('Max', 260, 720), t('Min', 285, 720), t('Sec', 310, 720),
    t('Grade', 485, 720), t('GP', 510, 720), t('Credit', 535, 720), t('CP', 560, 720), t('Result', 590, 720),
    t('SGPA', 200, 300), t('CGPA', 300, 300),
    t(sgpa, 204, 288), t(cgpa, 304, 288),
  ];
}

// 25BCT040-style Sem 1: counted CP 89.8 / 12 → 7.5
const SEM1_ITEMS: PositionedText[] = [
  ...header('I', '7.5', '7.5'),
  ...row(700, '25AEC01', 'Tamil - I', [60, 24, 40, 40, 16, 30, 100, 40, 70, 'A', 7.0, 3, 21.0, 'PASS']),
  ...row(680, '25AEC21', 'English - I', [60, 24, 45, 40, 16, 35, 100, 40, 80, 'A+', 8.0, 3, 24.0, 'PASS']),
  ...row(660, '25CSS01A', ['Object Oriented', 'Programming using C++'], [30, 12, 20, 20, 8, 15, 50, 20, 35, 'A', 7.0, 3, 21.0, 'PASS']),
  ...row(636, '25CSS01B', ['Practical: Object Oriented', 'Programming using C++'], [30, 12, 27, 20, 8, 19, 50, 20, 46, 'O', 9.2, 1, 9.2, 'PASS']),
  ...row(612, '25CSS02', 'Data Structures and Algorithms', [60, 24, 45, 40, 16, 33, 100, 40, 78, 'A', 7.8, 4, 31.2, 'PASS']),
  ...row(592, '25MCU06', ['Mathematical Foundation for', 'Computer Science'], [60, 24, 40, 40, 16, 31, 100, 40, 71, 'A', 7.1, 4, 28.4, 'PASS']),
  ...row(568, '25VAC01', 'Environmental Studies', ['-', '-', '-', 100, 40, 90, 100, 40, 90, 'O', 9.0, 2, 18.0, 'PASS']),
];

describe('groupLines', () => {
  it('groups items with small y jitter into one line', () => {
    const lines = groupLines([t('a', 0, 100), t('b', 10, 100.6), t('c', 0, 90)]);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe('a b');
  });
});

describe('parseItems (synthetic Statement of Grade)', () => {
  const sheet = parseItems(SEM1_ITEMS, 'skasctn-DGMST-202525BCT040INOVEMBER.pdf');

  it('reads the header', () => {
    expect(sheet.studentName).toBe('ARJUN K');
    expect(sheet.regNo).toBe('25BCT040');
    expect(sheet.semester).toBe(1);
    expect(sheet.examMonth).toBe('November 2025');
    expect(sheet.printedSgpa).toBe(7.5);
    expect(sheet.printedCgpa).toBe(7.5);
  });

  it('finds every subject with its columns', () => {
    expect(sheet.subjects.map((s) => s.code)).toEqual(['25AEC01', '25AEC21', '25CSS01A', '25CSS01B', '25CSS02', '25MCU06', '25VAC01']);
    const cpp = sheet.subjects.find((s) => s.code === '25CSS01A')!;
    expect(cpp).toMatchObject({ totalMax: 50, totalSecured: 35, grade: 'A', gradePoint: 7, credits: 3, creditPoints: 21, result: 'PASS', extMax: 30, extSecured: 20, intMax: 20, intSecured: 15 });
  });

  it('joins wrapped subject names', () => {
    expect(sheet.subjects.find((s) => s.code === '25MCU06')!.name).toBe('Mathematical Foundation for Computer Science');
    expect(sheet.subjects.find((s) => s.code === '25CSS01B')!.name).toBe('Practical: Object Oriented Programming using C++');
  });

  it('applies the counting rules and verifies against the printed SGPA', () => {
    const tot = sheetTotals(sheet.subjects);
    expect(tot.credits).toBe(12);
    expect(tot.creditPoints).toBeCloseTo(89.8, 6);
    expect(roundHalfUp(tot.sgpa, 1)).toBe(7.5);
    expect(verifySheet(sheet).status).toBe('verified');
  });

  it('detects the semester from the filename or codes when the header lacks it', () => {
    const noSem = SEM1_ITEMS.filter((i) => !i.str.startsWith('Semester'));
    expect(parseItems(noSem, 'skasctn-DGMST-202625BCT040IIAPRIL.pdf').semester).toBe(2);
    expect(parseItems(noSem, 'marks.pdf').semester).toBe(1);
  });

  it('excludes a failed subject and flags a mismatch', () => {
    const items = SEM1_ITEMS.map((i) => ({ ...i }));
    // Fail MCU06: total 30, grade U, result FAIL (printed SGPA stays 7.5 → mismatch is expected)
    const y = 592;
    const set = (col: number, v: string) => {
      const it = items.find((i) => Math.abs(i.y - y) < 1 && Math.abs(i.x - COLS[col]) < 2)!;
      it.str = v;
    };
    set(8, '30'); set(9, 'U'); set(10, '0'); set(12, '0'); set(13, 'FAIL');
    const s = parseItems(items, 'x.pdf');
    const tot = sheetTotals(s.subjects);
    expect(tot.credits).toBe(8);
    expect(tot.creditPoints).toBeCloseTo(61.4, 6);
    expect(verifySheet(s).status).toBe('mismatch');
  });

  it('reads inline "SGPA : 8.1" labels', () => {
    const items = SEM1_ITEMS.filter((i) => !/^(SGPA|CGPA|7\.5)$/.test(i.str)).concat([t('SGPA : 8.1', 200, 300), t('CGPA : 7.8', 300, 300)]);
    const s = parseItems(items, 'x.pdf');
    expect(s.printedSgpa).toBe(8.1);
    expect(s.printedCgpa).toBe(7.8);
  });

  it('does not mistake a register number for a subject code', () => {
    expect(sheet.subjects.some((s) => s.code.startsWith('25BCT'))).toBe(false);
  });
});
