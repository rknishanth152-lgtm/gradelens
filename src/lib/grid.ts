/**
 * Find a ruled table's grid (horizontal and vertical rule lines) in a greyscale raster.
 * Pure function so it can be unit-tested and shared by browser and Node.
 */
import { resize, type Raster } from './imagePrep';

export interface Grid {
  /** y of each horizontal rule, top to bottom */
  rows: number[];
  /** x of each vertical rule, left to right */
  cols: number[];
  /** Every horizontal rule across the table, including uneven rows (wrapped names). */
  allRows: number[];
}

function darkMask(src: Raster): Uint8Array {
  const { data, width: w, height: h } = src;
  const n = w * h;
  const g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
  // Local-mean threshold (rule lines are thin and often light grey).
  const W1 = w + 1;
  const I = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += g[y * w + x];
      I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row;
    }
  }
  const r = Math.max(6, Math.round(Math.min(w, h) / 80));
  const out = new Uint8Array(n);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r);
    const y1 = Math.min(h - 1, y + r);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      const mean = (I[(y1 + 1) * W1 + x1 + 1] - I[y0 * W1 + x1 + 1] - I[(y1 + 1) * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0 + 1) * (y1 - y0 + 1));
      out[y * w + x] = g[y * w + x] < mean - 6 && g[y * w + x] < 242 ? 1 : 0;
    }
  }
  return out;
}

/** Longest run of ink along a line, bridging small gaps (JPEG noise, slight tilt). */
function longestRun(get: (i: number) => number, len: number, bridge: number): number {
  let best = 0;
  let cur = 0;
  let gap = 0;
  for (let i = 0; i < len; i++) {
    if (get(i)) {
      cur += gap + 1;
      gap = 0;
      if (cur > best) best = cur;
    } else if (cur > 0 && gap < bridge) gap++;
    else {
      cur = 0;
      gap = 0;
    }
  }
  return best;
}

function merge(positions: number[], tol: number): number[] {
  const out: number[][] = [];
  for (const p of positions) {
    const last = out[out.length - 1];
    if (last && p - last[last.length - 1] <= tol) last.push(p);
    else out.push([p]);
  }
  return out.map((g) => Math.round(g.reduce((a, b) => a + b, 0) / g.length));
}

/**
 * The table body is the longest chain of rules with similar spacing. A missed rule shows up as a
 * double gap, so fill it in with the midpoint.
 */
export function tableBody(rows: number[]): number[] {
  if (rows.length < 3) return rows;
  const gaps = rows.slice(1).map((y, i) => y - rows[i]);
  const sorted = [...gaps].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  let best: number[] = [];
  let cur: number[] = [rows[0]];
  for (let i = 1; i < rows.length; i++) {
    const g = rows[i] - rows[i - 1];
    if (g >= med * 0.55 && g <= med * 2.6) {
      if (g > med * 1.6) cur.push(Math.round((rows[i] + rows[i - 1]) / 2));
      cur.push(rows[i]);
    } else {
      if (cur.length > best.length) best = cur;
      cur = [rows[i]];
    }
  }
  if (cur.length > best.length) best = cur;
  return best;
}

/** Work on a ~1100px-wide copy (lines survive downscaling; memory stays phone-friendly), then scale back. */
export function detectGrid(full: Raster): Grid | null {
  const f = full.width > 1300 ? full.width / 1100 : 1;
  const src = f > 1 ? resize(full, Math.round(full.width / f), Math.round(full.height / f)) : full;
  const g = detectGridAt(src);
  const up = (a: number[]) => a.map((v) => Math.round(v * f));
  return g && f > 1 ? { rows: up(g.rows), cols: up(g.cols), allRows: up(g.allRows) } : g;
}

function detectGridAt(src: Raster): Grid | null {
  const { width: w, height: h } = src;
  const dark = darkMask(src);
  const bridge = Math.max(2, Math.round(w / 400));
  const hCand: number[] = [];
  for (let y = 0; y < h; y++) if (longestRun((x) => dark[y * w + x], w, bridge) >= w * 0.4) hCand.push(y);
  const merged = merge(hCand, Math.max(2, Math.round(h / 600)));
  let rows = tableBody(merged);
  if (rows.length < 4) return null;
  const top = rows[0];
  const bottom = rows[rows.length - 1];
  const span = bottom - top;
  const vCand: number[] = [];
  for (let x = 0; x < w; x++) if (longestRun((y) => dark[(top + y) * w + x], span, bridge) >= span * 0.35) vCand.push(x);
  const cols = merge(vCand, Math.max(2, Math.round(w / 500)));
  if (cols.length < 3) return null;
  // Drop horizontal rules that don't span the table's columns (e.g. text underlines).
  const left = cols[0];
  const right = cols[cols.length - 1];
  rows = rows.filter((y) => longestRun((x) => dark[y * w + left + x], right - left, bridge * 2) >= (right - left) * 0.5);
  if (rows.length < 4) return null;
  const allRows = merged.filter((y) => longestRun((x) => dark[y * w + left + x], right - left, bridge * 2) >= (right - left) * 0.5);
  return { rows, cols, allRows };
}
