import { describe, expect, it } from 'vitest';
import { decideMarks, findMarkColumns, splitGlued } from '../lib/ocrTable';
import type { OcrWord } from '../lib/imagePrep';

const T = { ciaMax: 20, eseMax: 30, totalMax: 50 };
const C = { ciaMax: 100, eseMax: 0, totalMax: 100 };
const w = (text: string, x0: number, y0: number, x1 = x0 + 60, y1 = y0 + 24): OcrWord => ({ text, confidence: 90, bbox: { x0, y0, x1, y1 } });

describe('decideMarks', () => {
  it('is sure when CIA + ESE = TOTAL', () => expect(decideMarks(16, 25, 41, T)).toMatchObject({ total: 41, confidence: 'high' }));
  it('trusts CIA + ESE over a misread total, but flags it', () => expect(decideMarks(28, 39, 87, { ciaMax: 40, eseMax: 60, totalMax: 100 })).toMatchObject({ total: 67, confidence: 'check' }));
  it('falls back to the total alone', () => expect(decideMarks(null, null, 43, T)).toMatchObject({ total: 43, confidence: 'check' }));
  it('rejects impossible numbers', () => expect(decideMarks(25, 31, null, T)).toBeNull());
  it('is sure for internal-only papers when CIA = TOTAL', () => expect(decideMarks(77, null, 77, C)).toMatchObject({ total: 77, confidence: 'high' }));
  it('flags internal-only when only one cell reads', () => expect(decideMarks(null, null, 75, C)).toMatchObject({ total: 75, confidence: 'check' }));
});

describe('findMarkColumns', () => {
  it('finds CIA < ESE < TOTAL on one line and ignores a stray TOTAL elsewhere', () => {
    const cols = findMarkColumns([w('TOTAL', 50, 900), w('CIA', 600, 100), w('ESE', 700, 100), w('TOTAL', 800, 100), w('RESULT', 920, 100)]);
    expect(cols).not.toBeNull();
    expect(cols!.cells.map((c) => c.key)).toEqual(['cia', 'ese', 'tot']);
    expect(cols!.cells[0].left).toBeLessThan(600);
    expect(cols!.cells[2].left + cols!.cells[2].width).toBeLessThanOrEqual(920);
  });
});

describe('splitGlued', () => {
  it('splits glued two-digit numbers', () => expect(splitGlued('1625 41')).toEqual([16, 25, 41]));
});
