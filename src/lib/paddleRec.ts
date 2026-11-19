/**
 * PaddleOCR text-line recognizer (PP-OCRv5 English mobile, ONNX/ORT format) on top of ONNX Runtime.
 * Recognition only: we already know where every table cell is, so no detector is needed.
 * Works with onnxruntime-web (browser) and onnxruntime-node (accuracy script): pass the module in.
 */
import type { Raster } from './imagePrep';

interface OrtTensor {
  data: Float32Array | ArrayLike<number>;
  dims: readonly number[];
}
interface OrtLike {
  Tensor: new (type: 'float32', data: Float32Array, dims: number[]) => OrtTensor;
  InferenceSession: { create(model: Uint8Array | ArrayBuffer | string, opts?: unknown): Promise<OrtSession> };
}
interface OrtSession {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, OrtTensor>): Promise<Record<string, OrtTensor>>;
}

const H = 48;

export class PaddleRecognizer {
  private constructor(
    private ort: OrtLike,
    private session: OrtSession,
    private chars: string[],
  ) {}

  /** dictText: the model's character list, one per line (index 0 is the CTC blank). */
  static async create(ort: OrtLike, model: Uint8Array | ArrayBuffer | string, dictText: string, opts?: unknown) {
    const session = await ort.InferenceSession.create(model, opts);
    const lines = dictText.split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    // Index 0 is the CTC blank; some dictionaries already reserve it as an empty first line.
    const chars = lines[0] === '' ? [...lines, ' '] : ['', ...lines, ' '];
    return new PaddleRecognizer(ort, session, chars);
  }

  /** Recognize one text line (RGBA raster). Returns the text and mean confidence. */
  async recognize(img: Raster, whitelist?: string): Promise<{ text: string; confidence: number }> {
    const w = Math.max(16, Math.min(1280, Math.round((img.width * H) / img.height)));
    const data = new Float32Array(3 * H * w);
    // Bilinear resize to H×w, normalise to [-1, 1], CHW.
    const sx = img.width / w;
    const sy = img.height / H;
    for (let y = 0; y < H; y++) {
      const fy = Math.min(img.height - 1, Math.max(0, (y + 0.5) * sy - 0.5));
      const y0 = Math.floor(fy);
      const y1 = Math.min(img.height - 1, y0 + 1);
      const wy = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = Math.min(img.width - 1, Math.max(0, (x + 0.5) * sx - 0.5));
        const x0 = Math.floor(fx);
        const x1 = Math.min(img.width - 1, x0 + 1);
        const wx = fx - x0;
        for (let c = 0; c < 3; c++) {
          const p = (yy: number, xx: number) => img.data[(yy * img.width + xx) * 4 + (2 - c)]; // BGR like cv2
          const v = (p(y0, x0) * (1 - wx) + p(y0, x1) * wx) * (1 - wy) + (p(y1, x0) * (1 - wx) + p(y1, x1) * wx) * wy;
          data[c * H * w + y * w + x] = (v / 255 - 0.5) / 0.5;
        }
      }
    }
    const input = new this.ort.Tensor('float32', data, [1, 3, H, w]);
    const out = await this.session.run({ [this.session.inputNames[0]]: input });
    const t = out[this.session.outputNames[0]];
    const [, T, C] = t.dims as number[];
    if (C !== this.chars.length && C !== this.chars.length - 1) throw new Error(`dictionary has ${this.chars.length} symbols, model outputs ${C}`);
    const probs = t.data as Float32Array;
    const allowed = whitelist ? new Set(whitelist.split('')) : null;
    let text = '';
    let prev = -1;
    let confSum = 0;
    let confN = 0;
    for (let i = 0; i < T; i++) {
      let best = 0;
      let bestP = -Infinity;
      for (let k = 0; k < C; k++) {
        const ch = this.chars[k];
        // Whitelist: only blank, space and allowed characters may win.
        if (allowed && k !== 0 && ch !== ' ' && !allowed.has(ch)) continue;
        const pk = probs[i * C + k];
        if (pk > bestP) {
          bestP = pk;
          best = k;
        }
      }
      if (best !== 0 && best !== prev) {
        text += this.chars[best] ?? '';
        confSum += bestP;
        confN++;
      }
      prev = best;
    }
    return { text: text.trim(), confidence: confN ? confSum / confN : 0 };
  }
}
