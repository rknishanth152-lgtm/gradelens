/**
 * Drop real DigiLocker "Statement of Grade" PDFs into /test-fixtures and run `npm test`.
 * Each one is parsed and its computed SGPA (1 decimal) must equal the printed SGPA.
 * With no fixtures present, the suite is skipped.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { extractPdfItems, parseItems, verifySheet } from '../lib/pdfParser';
import { roundHalfUp } from '../lib/grading';

const dir = resolve(__dirname, '../../test-fixtures');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.pdf$/i.test(f)) : [];

describe.skipIf(files.length === 0)('DigiLocker PDF fixtures', () => {
  for (const f of files) {
    it(`${f}: computed SGPA matches printed SGPA`, async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const require = createRequire(import.meta.url);
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')).href;
      const items = await extractPdfItems(pdfjs as never, new Uint8Array(readFileSync(join(dir, f))));
      const sheet = parseItems(items, f);
      const v = verifySheet(sheet);
      expect(sheet.subjects.length).toBeGreaterThan(0);
      expect(sheet.printedSgpa).not.toBeNull();
      expect(roundHalfUp(v.computed, 1)).toBe(sheet.printedSgpa);
    });
  }
});
