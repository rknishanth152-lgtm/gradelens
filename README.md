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
