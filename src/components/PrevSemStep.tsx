import { useMemo, useState } from 'react';
import { FileText, RefreshCw, TriangleAlert } from 'lucide-react';
import { useStore } from '../state/store';
import { computePrev, parseSgpa, type PrevSemInput, type SemNo } from '../lib/prevSem';
import { FriendlyParseError, isPassed, parsePdfFile, type ParsedSheet, type ParsedSubject } from '../lib/pdfParser';
import { fmt, gradePoint, isCounted, roundHalfUp } from '../lib/grading';
import { PREV_SUBJECTS, DEFAULT_PREV_CREDITS } from '../data/subjects';
import { parseMark } from '../lib/sem3';
import { UploadDropzone } from './UploadDropzone';
import { Button, Card, MarkInput, Notice, Segmented, cx } from './ui';

function SheetPreview({ sheet, onChange }: { sheet: ParsedSheet; onChange: (s: ParsedSheet) => void }) {
  const setSub = (i: number, patch: Partial<ParsedSubject>) => onChange({ ...sheet, subjects: sheet.subjects.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line">
      {sheet.subjects.map((s, i) => {
        const counted = isCounted(s.code);
        const passed = isPassed(s);
        const max = s.totalMax ?? 100;
        const markErr = s.totalSecured != null && s.totalSecured > max ? `Max is ${max}` : undefined;
        return (
          <li key={s.code + i} className={cx('p-3.5', !counted && 'opacity-60')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14.5px] font-semibold leading-snug text-fg">{s.name}</p>
                <p className="text-[12px] text-muted tabular" translate="no">
                  {s.code}
                  {s.grade ? ` · grade ${s.grade}` : ''}
                </p>
              </div>
              {counted ? (
                <button
                  type="button"
                  onClick={() => setSub(i, { result: passed ? 'FAIL' : 'PASS', grade: passed ? 'U' : s.grade === 'U' ? null : s.grade })}
                  aria-label={`${s.code} result: ${passed ? 'pass' : 'fail'}. Tap to change.`}
                  className={cx('h-7 shrink-0 rounded-full border px-2.5 text-[12px] font-semibold', passed ? 'border-pass/30 bg-pass/10 text-pass' : 'border-fail/30 bg-fail/10 text-fail')}
                >
                  {passed ? 'Pass' : 'Fail'}
                </button>
              ) : (
                <span className="shrink-0 rounded-full border border-line-strong px-2 py-0.5 text-[11.5px] font-semibold text-muted">Not counted</span>
              )}
            </div>
            {counted && (
              <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-3">
                <MarkInput
                  id={`pv-${s.code}-${i}`}
                  label="Total marks"
                  value={s.totalSecured == null ? '' : String(s.totalSecured)}
                  max={max}
                  error={markErr}
                  onChange={(v) => {
                    const p = parseMark(v, 1000);
                    setSub(i, { totalSecured: p.value });
                  }}
                />
                <div>
                  <label htmlFor={`pc-${s.code}-${i}`} className="mb-1.5 block text-[13px] font-medium text-muted">
                    Credits
                  </label>
                  <select id={`pc-${s.code}-${i}`} className="field !w-20 tabular" value={s.credits ?? ''} onChange={(e) => setSub(i, { credits: e.target.value === '' ? null : Number(e.target.value) })}>
                    <option value="">–</option>
                    {[0, 1, 2, 3, 4, 5, 6].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                {s.totalSecured != null && passed && s.credits != null && (
                  <p className="col-span-2 text-[12.5px] text-faint tabular">
                    Grade point {fmt(gradePoint(s.totalSecured, max), 1)} × {s.credits} = {fmt(gradePoint(s.totalSecured, max) * s.credits, 1)} credit points
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function UploadPane({ sem, input, setInput }: { sem: SemNo; input: PrevSemInput; setInput: (p: Partial<PrevSemInput>) => void }) {
  const { state, update } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [misplaced, setMisplaced] = useState<ParsedSheet | null>(null);
  const result = useMemo(() => computePrev(sem, input), [sem, input]);
  const other = state.prev[sem === 1 ? 2 : 1].sheet;
  const sheet = input.sheet;

  const handle = async (f: File) => {
    setError(null);
    setMisplaced(null);
    setBusy(true);
    try {
      const s = await parsePdfFile(f);
      if (s.semester && s.semester !== sem) {
        setMisplaced(s);
      } else {
        setInput({ sheet: s, method: 'pdf' });
      }
    } catch (e) {
      setError(e instanceof FriendlyParseError ? e.message : "Something went wrong reading that file. Try again, or type your SGPA in.");
    } finally {
      setBusy(false);
    }
  };

  const moveMisplaced = () => {
    if (!misplaced?.semester) return;
    const target = misplaced.semester as SemNo;
    update((s) => ({ ...s, prev: { ...s.prev, [target]: { ...s.prev[target], sheet: misplaced, method: 'pdf' } }, cgpaStep: target - 1 }));
    setMisplaced(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="space-y-3">
      {!sheet && <UploadDropzone onFile={handle} busy={busy} sem={sem} />}
      {error && (
        <Notice
          tone="error"
          action={
            <Button variant="secondary" className="w-full !min-h-10 text-[14px]" onClick={() => setInput({ method: 'manual' })}>
              Type it in instead
            </Button>
          }
        >
          {error}
        </Notice>
      )}
      {misplaced && (
        <Notice
          tone="warn"
          action={
            misplaced.semester === 1 || misplaced.semester === 2 ? (
              <Button className="w-full !min-h-10 text-[14px]" onClick={moveMisplaced}>
                Move to Sem {misplaced.semester}
              </Button>
            ) : undefined
          }
        >
          {misplaced.semester === 1 || misplaced.semester === 2
            ? `This looks like your Sem ${misplaced.semester} sheet. Move it there?`
            : `This looks like a Sem ${misplaced.semester} sheet. This step needs Sem ${sem}.`}
        </Notice>
      )}

      {sheet && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line-strong text-muted">
                <FileText size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-fg">{sheet.studentName ?? 'Statement of Grade'}</p>
                <p className="text-[13px] text-muted tabular">
                  {[sheet.regNo, sheet.semester ? `Semester ${sheet.semester}` : null, sheet.examMonth].filter(Boolean).join(' · ') || sheet.fileName}
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setInput({ sheet: null })} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-[13.5px] font-semibold text-muted hover:text-fg">
              <RefreshCw size={15} aria-hidden="true" />
              Different file
            </button>
          </div>

          {result.verification?.status === 'verified' && (
            <Notice tone="ok">
              <span className="font-semibold">
                Matches your official SGPA ({result.verification.printed?.toFixed(1)})
              </span>
              <span className="mt-0.5 block text-muted">
                Precise SGPA {fmt(result.sgpa, 2)} from {fmt(result.creditPoints, 1)} credit points over {result.credits} counted credits.
              </span>
            </Notice>
          )}
          {result.verification?.status === 'mismatch' && (
            <Notice
              tone="warn"
              action={
                <Button variant="secondary" className="w-full !min-h-10 text-[14px]" onClick={() => setInput({ method: 'manual' })}>
                  Type it in
                </Button>
              }
            >
              We got {roundHalfUp(result.sgpa, 1).toFixed(1)}, your sheet says {result.verification.printed?.toFixed(1)}. One of the rows below is probably misread. Fix it, or type the SGPA in instead.
            </Notice>
          )}
          {result.verification?.status === 'unknown' && (
            <Notice tone="warn">We couldn't find the printed SGPA to check against, so look over the marks below before moving on.</Notice>
          )}
          {other?.regNo && sheet.regNo && other.regNo !== sheet.regNo && (
            <Notice tone="warn">
              Register numbers don't match: this sheet is {sheet.regNo}, your Sem {sem === 1 ? 2 : 1} sheet is {other.regNo}.
            </Notice>
          )}
          {sheet.warnings
            .filter((w) => !/printed SGPA/.test(w))
            .map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}

          <div>
            <h3 className="mb-2 mt-2 text-[16px] font-bold text-fg">Here's what we read. Tap any number to fix it.</h3>
            <SheetPreview sheet={sheet} onChange={(s) => setInput({ sheet: s })} />
          </div>
        </>
      )}
    </div>
  );
}

function ManualPane({ sem, input, setInput }: { sem: SemNo; input: PrevSemInput; setInput: (p: Partial<PrevSemInput>) => void }) {
  const sg = parseSgpa(input.quickSgpa);
  const subjects = PREV_SUBJECTS[sem];
  const counted = subjects.filter((s) => s.counted);
  const skipped = subjects.filter((s) => !s.counted);
  return (
    <div className="space-y-4">
      <Segmented
        label="Manual entry mode"
        value={input.manualMode}
        onChange={(v) => setInput({ manualMode: v })}
        options={[
          { value: 'quick', label: 'Just the SGPA' },
          { value: 'detailed', label: 'Every mark' },
        ]}
      />
      {input.manualMode === 'quick' ? (
        <div className="space-y-3">
          <MarkInput id={`q-sgpa-${sem}`} label={`Official SGPA from your Sem ${sem} marksheet`} value={input.quickSgpa} max={10} error={sg.error ?? undefined} onChange={(v) => setInput({ quickSgpa: v })} placeholder="e.g. 7.5…" />
          <p className="text-[13px] leading-snug text-muted">The printed SGPA is rounded to one decimal, so your CGPA can be off by a hair. The PDF or every mark gives the exact figure.</p>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
            <label htmlFor={`q-cr-${sem}`} className="text-[14px] text-fg">
              Counted credits in Sem {sem}
              <span className="block text-[12px] text-muted">Default {DEFAULT_PREV_CREDITS[sem]}. Change only if yours differ.</span>
            </label>
            <select id={`q-cr-${sem}`} className="field !w-20 tabular" value={input.quickCredits} onChange={(e) => setInput({ quickCredits: Number(e.target.value) })}>
              {Array.from({ length: 16 }, (_, i) => i + 8).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : (
        <div>
          <ul className="divide-y divide-line">
            {counted.map((s) => {
              const v = input.detailed[s.id] ?? '';
              const p = parseMark(v, s.totalMax);
              return (
                <li key={s.id} className="py-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-[14.5px] font-semibold text-fg">{s.name}</p>
                    <span className="shrink-0 text-[12px] text-muted tabular">{s.credits} cr</span>
                  </div>
                  <MarkInput id={`d-${sem}-${s.id}`} label={`${s.name} total`} hideLabel value={v} max={s.totalMax} error={p.error ?? undefined} onChange={(nv) => setInput({ detailed: { ...input.detailed, [s.id]: nv } })} placeholder="Total…" />
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[13px] text-muted">No need for these, they aren't counted: {skipped.map((s) => s.name).join(', ')}.</p>
        </div>
      )}
    </div>
  );
}

export function PrevSemStep({ sem, onNext, onBack }: { sem: SemNo; onNext: () => void; onBack: () => void }) {
  const { state, update } = useStore();
  const input = state.prev[sem];
  const setInput = (p: Partial<PrevSemInput>) => update((s) => ({ ...s, prev: { ...s.prev, [sem]: { ...s.prev[sem], ...p } } }));
  const result = useMemo(() => computePrev(sem, input), [sem, input]);
  const month = sem === 1 ? 'Nov 2025' : 'Apr 2026';

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-6">
        <Segmented
          label={`How to add Sem ${sem}`}
          value={input.method}
          onChange={(v) => setInput({ method: v })}
          options={[
            { value: 'pdf', label: 'DigiLocker PDF' },
            { value: 'manual', label: 'Type it in' },
          ]}
        />
        <p className="mt-3 text-[13px] text-muted">
          {input.method === 'pdf' ? `Best option: we read every paper from your ${month} sheet and check it against the printed SGPA.` : `Have your ${month} marksheet handy.`}
        </p>
        <div className="mt-4">{input.method === 'pdf' ? <UploadPane sem={sem} input={input} setInput={setInput} /> : <ManualPane sem={sem} input={input} setInput={setInput} />}</div>
      </Card>

      <div className="safe-bottom sticky bottom-0 z-20 -mx-4 border-t-[1.5px] border-dashed border-line-strong bg-bg/90 px-4 pt-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onBack} className="shrink-0">
            Back
          </Button>
          <Button onClick={onNext} disabled={!result.valid} className="flex-1 sm:flex-none sm:min-w-56 sm:ml-auto">
            {result.valid ? `Next: Sem ${sem} is ${fmt(result.sgpa, 2)}` : `Add Sem ${sem} first`}
          </Button>
        </div>
        {!result.valid && input.method === 'pdf' && input.sheet && (
          <p className="mt-2 flex items-center gap-1.5 text-[13px] text-warn">
            <TriangleAlert size={15} aria-hidden="true" /> A few marks or credits are still empty above.
          </p>
        )}
      </div>
    </div>
  );
}
