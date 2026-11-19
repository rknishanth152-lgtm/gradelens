import { describe, expect, it } from 'vitest';
import { cleanForOcr } from '../lib/imagePrep';

function canvas(w: number, h: number) {
  const px = new Uint8ClampedArray(w * h * 4).fill(255);
  const dot = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = 0;
  };
  return { px, dot, at: (x: number, y: number) => px[(y * w + x) * 4] };
}

describe('cleanForOcr', () => {
  it('erases long ruling lines but keeps short text strokes', () => {
    const w = 400, h = 300;
    const c = canvas(w, h);
    for (let x = 10; x < 390; x++) c.dot(x, 50); // table rule
    for (let y = 10; y < 290; y++) c.dot(200, y); // column rule
    for (let y = 100; y < 115; y++) for (let x = 60; x < 63; x++) c.dot(x, y); // a letter stroke
    cleanForOcr(c.px, w, h);
    expect(c.at(100, 50)).toBe(255);
    expect(c.at(200, 150)).toBe(255);
    expect(c.at(61, 107)).toBe(0);
  });
});
