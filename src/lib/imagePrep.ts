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

export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Bilinear resize (RGBA). */
export function resize(src: Raster, width: number, height: number): Raster {
  const out = new Uint8ClampedArray(width * height * 4);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5);
    const y0 = Math.min(src.height - 1, Math.floor(fy));
    const y1 = Math.min(src.height - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = Math.max(0, (x + 0.5) * sx - 0.5);
      const x0 = Math.min(src.width - 1, Math.floor(fx));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const wx = fx - x0;
      const a = (y0 * src.width + x0) * 4;
      const b = (y0 * src.width + x1) * 4;
      const c = (y1 * src.width + x0) * 4;
      const d = (y1 * src.width + x1) * 4;
      const o = (y * width + x) * 4;
      for (let k = 0; k < 4; k++) {
        out[o + k] = (src.data[a + k] * (1 - wx) + src.data[b + k] * wx) * (1 - wy) + (src.data[c + k] * (1 - wx) + src.data[d + k] * wx) * wy;
      }
    }
  }
  return { data: out, width, height };
}

/**
 * Scale so the page is ~2200px wide (phone screenshots are 600–1000px, far too small for OCR),
 * capped at 4× and ~14 MP, then threshold and strip ruling lines.
 */
export function prepareForOcr(src: Raster, opts: { binarize?: boolean } = {}): Raster {
  const target = 2200;
  let scale = src.width < target ? Math.min(4, target / src.width) : src.width > 3000 ? 3000 / src.width : 1;
  const maxPixels = 14e6;
  if (src.width * src.height * scale * scale > maxPixels) scale = Math.sqrt(maxPixels / (src.width * src.height));
  const r = Math.abs(scale - 1) < 0.02 ? { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height } : resize(src, Math.round(src.width * scale), Math.round(src.height * scale));
  if (opts.binarize) cleanForOcr(r.data, r.width, r.height);
  else toGray(r.data);
  return r;
}

/** Greyscale in place (tesseract does its own thresholding, which copes better with shaded table rows). */
export function toGray(px: Uint8ClampedArray): void {
  for (let j = 0; j < px.length; j += 4) {
    const g = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2];
    px[j] = px[j + 1] = px[j + 2] = g;
    px[j + 3] = 255;
  }
}

/** Tesseract settings: treat the page as one uniform block of text, keep spacing. */
export const OCR_PARAMS = { preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' } as const;

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** OCR words → positioned text (y flipped so it grows upwards, like PDF space). */
export function ocrWordsToItems(words: OcrWord[]) {
  return words
    .filter((w) => w.text.trim() && w.confidence > 15)
    .map((w) => ({ str: w.text, x: w.bbox.x0, y: -w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 }));
}

/** Otsu threshold of a greyscale histogram. */
function otsu(gray: Float32Array): number {
  const hist = new Array(256).fill(0);
  for (const g of gray) hist[Math.max(0, Math.min(255, Math.round(g)))]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

/**
 * Prepare one table cell for digit OCR: crop, enlarge so digits are ~60px tall,
 * threshold locally (handles grey/striped rows), erase rule lines, pad with white.
 */
export function enhanceCell(src: Raster, rect: { left: number; top: number; width: number; height: number }): Raster {
  const l = Math.max(0, Math.min(src.width - 1, Math.round(rect.left)));
  const t = Math.max(0, Math.min(src.height - 1, Math.round(rect.top)));
  const w = Math.max(4, Math.min(src.width - l, Math.round(rect.width)));
  const h = Math.max(4, Math.min(src.height - t, Math.round(rect.height)));
  const crop = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) crop.set(src.data.subarray(((t + y) * src.width + l) * 4, ((t + y) * src.width + l + w) * 4), y * w * 4);
  const k = Math.max(1, Math.min(4, 110 / h));
  const big = k > 1.05 ? resize({ data: crop, width: w, height: h }, Math.round(w * k), Math.round(h * k)) : { data: crop, width: w, height: h };
  const W = big.width;
  const H = big.height;
  const gray = new Float32Array(W * H);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = 0.299 * big.data[j] + 0.587 * big.data[j + 1] + 0.114 * big.data[j + 2];
  const thr = otsu(gray);
  // Text is darker than its background here; if most pixels are "dark", the cell is inverted.
  let darkCount = 0;
  for (const g of gray) if (g < thr) darkCount++;
  const invert = darkCount > gray.length * 0.6;
  const dark = new Uint8Array(W * H);
  for (let i = 0; i < gray.length; i++) dark[i] = (invert ? gray[i] > thr : gray[i] < thr) ? 1 : 0;
  // Erase rule lines: columns/rows that are mostly dark.
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) c += dark[y * W + x];
    // A rule runs nearly the full height; a digit '1' doesn't, so keep those.
    if (c > H * 0.88) for (let y = 0; y < H; y++) dark[y * W + x] = 0;
  }
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x++) c += dark[y * W + x];
    if (c > W * 0.85) for (let x = 0; x < W; x++) dark[y * W + x] = 0;
  }
  // Self-centre: keep only the band of ink closest to the middle (the row we want), drop neighbours.
  const rowInk = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rowInk[y] += dark[y * W + x];
  const bands: Array<[number, number]> = [];
  const gapTol = Math.round(3 * k);
  let start = -1;
  let lastInk = -1;
  for (let y = 0; y <= H; y++) {
    const ink = y < H && rowInk[y] > 0;
    if (ink) {
      if (start < 0) start = y;
      lastInk = y;
    } else if (start >= 0 && y - lastInk > gapTol) {
      bands.push([start, lastInk]);
      start = -1;
    }
  }
  if (start >= 0) bands.push([start, lastInk]);
  const tall = bands.filter(([a, b]) => b - a >= H * 0.12);
  if (tall.length > 1) {
    const mid = H / 2;
    const keep = tall.reduce((best, b) => (Math.abs((b[0] + b[1]) / 2 - mid) < Math.abs((best[0] + best[1]) / 2 - mid) ? b : best));
    for (let y = 0; y < H; y++) if (y < keep[0] - gapTol || y > keep[1] + gapTol) for (let x = 0; x < W; x++) dark[y * W + x] = 0;
  }

  const pad = 24;
  const OW = W + pad * 2;
  const OH = H + pad * 2;
  const out = new Uint8ClampedArray(OW * OH * 4).fill(255);
  // Output greyscale (not our binary mask): tesseract thresholds blurry digits better than we do.
  // Pixels outside the kept ink (rules, neighbouring rows) are painted white; contrast is stretched.
  let lo = 255;
  let hi = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = invert ? 255 - gray[i] : gray[i];
    if (dark[i]) lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const range = Math.max(1, hi - lo);
  // Grow the kept-ink mask a little so anti-aliased edges survive.
  const keep = new Uint8Array(W * H);
  const grow = Math.max(1, Math.round(k * 1.5));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (dark[y * W + x])
        for (let dy = -grow; dy <= grow; dy++)
          for (let dx = -grow; dx <= grow; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < H && xx >= 0 && xx < W) keep[yy * W + xx] = 1;
          }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!keep[y * W + x]) continue;
      const v = invert ? 255 - gray[y * W + x] : gray[y * W + x];
      const o = ((y + pad) * OW + x + pad) * 4;
      out[o] = out[o + 1] = out[o + 2] = Math.max(0, Math.min(255, ((v - lo) / range) * 255));
    }
  return { data: out, width: OW, height: OH };
}

/** Plain crop (clamped) — for recognizers that prefer raw pixels, like PaddleOCR. */
export function cropRaster(src: Raster, rect: { left: number; top: number; width: number; height: number }): Raster {
  const l = Math.max(0, Math.min(src.width - 1, Math.round(rect.left)));
  const t = Math.max(0, Math.min(src.height - 1, Math.round(rect.top)));
  const w = Math.max(2, Math.min(src.width - l, Math.round(rect.width)));
  const h = Math.max(2, Math.min(src.height - t, Math.round(rect.height)));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) out.set(src.data.subarray(((t + y) * src.width + l) * 4, ((t + y) * src.width + l + w) * 4), y * w * 4);
  return { data: out, width: w, height: h };
}

/**
 * Shrink a cell rectangle to the single line of ink nearest its middle (plus a margin).
 * Tall cells (wrapped rows) would otherwise shrink the text when a recognizer resizes to a fixed height.
 */
export function tightRect(src: Raster, rect: { left: number; top: number; width: number; height: number }) {
  const c = cropRaster(src, rect);
  const { width: w, height: h } = c;
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) gray[i] = 0.299 * c.data[j] + 0.587 * c.data[j + 1] + 0.114 * c.data[j + 2];
  const thr = otsu(gray);
  let dark = 0;
  for (const g of gray) if (g < thr) dark++;
  const invert = dark > gray.length * 0.6;
  const ink = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (invert ? gray[y * w + x] > thr : gray[y * w + x] < thr) ink[y]++;
  // Ignore rule-line rows (nearly full width).
  for (let y = 0; y < h; y++) if (ink[y] > w * 0.85) ink[y] = 0;
  const bands: Array<[number, number]> = [];
  let start = -1;
  for (let y = 0; y <= h; y++) {
    const on = y < h && ink[y] > Math.max(1, w * 0.01);
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      bands.push([start, y - 1]);
      start = -1;
    }
  }
  const real = bands.filter(([a, b]) => b - a >= 3);
  if (!real.length) return rect;
  const mid = h / 2;
  const [a, b] = real.reduce((best, x) => (Math.abs((x[0] + x[1]) / 2 - mid) < Math.abs((best[0] + best[1]) / 2 - mid) ? x : best));
  const th = b - a + 1;
  const pad = Math.round(th * 0.35);
  const top = Math.max(0, a - pad);
  const bottom = Math.min(h, b + 1 + pad);
  return { left: rect.left, top: rect.top + top, width: rect.width, height: bottom - top };
}
