/**
 * Clean a page image for OCR, in place (RGBA pixel buffer):
 *  1. adaptive threshold (local mean), which copes with shadows and uneven phone lighting;
 *  2. erase table ruling lines (long horizontal/vertical dark runs), which OCR otherwise reads as letters.
 * Pure function: no DOM, so it is unit-testable.
 */
export function cleanForOcr(px: Uint8ClampedArray, w: number, h: number): void {
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];

  // Integral image for fast local means.
  const W1 = w + 1;
  const integral = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += gray[y * w + x];
      integral[(y + 1) * W1 + x + 1] = integral[y * W1 + x + 1] + row;
    }
  }
  const r = Math.max(8, Math.round(Math.min(w, h) / 40));
  const C = 12;
  const dark = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * W1 + x1 + 1] - integral[y0 * W1 + x1 + 1] - integral[(y1 + 1) * W1 + x0] + integral[y0 * W1 + x0];
      dark[y * w + x] = gray[y * w + x] < sum / area - C ? 1 : 0;
    }
  }

  // Erase long runs (ruling lines). Text strokes are much shorter than these thresholds.
  const minH = Math.max(28, Math.round(w * 0.022));
  const minV = Math.max(28, Math.round(h * 0.035));
  const erase = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && dark[y * w + x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        if (x - start >= minH) for (let k = start; k < x; k++) erase[y * w + k] = 1;
        start = -1;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const on = y < h && dark[y * w + x] === 1;
      if (on && start < 0) start = y;
      if (!on && start >= 0) {
        if (y - start >= minV) for (let k = start; k < y; k++) erase[k * w + x] = 1;
        start = -1;
      }
    }
  }

  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const v = dark[i] && !erase[i] ? 0 : 255;
    px[j] = px[j + 1] = px[j + 2] = v;
    px[j + 3] = 255;
  }
}
