# GradeLens

SGPA, CGPA and percentage calculator for **SKASC B.Sc Computer Technology, batch 2025–28**.
Type your marks, photograph the result page, or drop in a PDF. Everything runs in the browser; no marks, PDFs or photos ever leave the phone.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 41 unit tests (grading, PDF parser, photo/PDF import, image clean-up)
npm run build      # static site in dist/
npm run preview    # serve dist/ at http://localhost:4173
```

To check the parser against real DigiLocker statements, drop the PDFs into `test-fixtures/` and run `npm test`. Each one must reproduce its printed SGPA. PDFs in that folder are git-ignored.

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. On vercel.com, click **Add New → Project** and import the repo.
3. Vercel detects Vite. Keep the defaults (build `npm run build`, output `dist`) and click **Deploy**.

Or from the terminal: `npm i -g vercel`, then `vercel --prod` in this folder.

## How it works

- `src/lib/grading.ts`: the college's rules (grade point = marks/max × 10; AEC/VAC/ANC papers and failed papers are excluded; CGPA is credit-weighted; half-up rounding; target planner).
- `src/lib/pdfParser.ts`: DigiLocker Statement of Grade → subjects, with a self-check against the printed SGPA.
- `src/lib/sem3Import.ts`: Sem 3 marks from any table (PDF text or OCR words). It fixes common OCR slips in codes and only marks a value "sure" when CIA + ESE = Total.
- `src/lib/readMarks.ts` and `imagePrep.ts`: PDF via pdf.js; photos via tesseract.js after an adaptive threshold and table-line removal. The first photo downloads the ~4 MB OCR model; the photo itself stays on the device.
- Design system: `design-system/gradelens/MASTER.md` ("Ink & Highlighter"). Illustrations are hand-written SVG in `src/components/art.tsx`.

## Notes

Sem 3 credits are estimates (19 counted); students can change them under "Change credits". This is an unofficial tool.

## Reading photos and screenshots

Uploads are read on the phone in two passes:

1. **Find the table:** tesseract.js reads the page once to find the rows and the CIA / ESE / TOTAL headers, and a grid detector finds ruled table lines.
2. **Read every cell:** each marks cell is read by both **PaddleOCR** (PP-OCRv5 English recognizer, ONNX Runtime Web) and **tesseract**. Arithmetic decides: CIA + ESE = TOTAL on result pages. On DigiLocker sheets, External + Internal, grade point and credit points must agree on each total, and the rows must reproduce the printed SGPA.

A value is only shown as sure when those checks pass; everything else is highlighted for the student to check. Run `npx vite-node scripts/eval-samples.ts` to measure accuracy against real marksheets kept in `test-fixtures/private/` (git-ignored).

### Open-source parts

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv5 English recognition model (Apache-2.0), in ORT format from [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr) (MIT). Served from `public/ocr/`.
- [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT). WASM served from `public/ort/`.
- [tesseract.js](https://github.com/naptha/tesseract.js) (Apache-2.0) and [pdf.js](https://github.com/mozilla/pdf.js) (Apache-2.0).
