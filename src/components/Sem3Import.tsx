import { useId, useRef, useState } from 'react';
import { Camera, FileUp, ImageUp, RotateCcw } from 'lucide-react';
import { useStore, type Sem3Source } from '../state/store';
import { importSem3 } from '../lib/sem3Import';
import { readMarksFile, type ReadProgress } from '../lib/readMarks';
import { FriendlyParseError } from '../lib/pdfParser';
import { emptyMark } from '../lib/sem3';
import { SEM3_SUBJECTS } from '../data/subjects';
import { IconPdfSheet, IconSnap, IconType, ScanningSheet } from './art';
import { Button, Notice, cx } from './ui';

const SOURCES: Array<{ value: Sem3Source; title: string; sub: string; icon: React.ReactNode }> = [
  { value: 'type', title: 'Type them', sub: 'Copy from the result page', icon: <IconType size={26} /> },
  { value: 'photo', title: 'Photo', sub: 'Snap or screenshot it', icon: <IconSnap size={26} /> },
  { value: 'pdf', title: 'PDF', sub: 'Result or DigiLocker file', icon: <IconPdfSheet size={26} /> },
];

export function SourcePicker() {
  const { state, update } = useStore();
  return (
    <div role="group" aria-label="How do you want to add your marks?" className="grid grid-cols-3 gap-2 sm:gap-3">
      {SOURCES.map((s) => {
        const active = state.sem3Source === s.value;
        return (
          <button
            key={s.value}
            type="button"
            aria-pressed={active}
            onClick={() => update((st) => ({ ...st, sem3Source: s.value }))}
            className={cx(
              'press flex min-h-[88px] cursor-pointer flex-col items-start justify-between gap-2 rounded-[18px] border-[1.5px] p-3 text-left sm:min-h-[96px] sm:p-4',
              active ? 'border-fg bg-surface shadow-[4px_4px_0_0_var(--offset)]' : 'border-line-strong bg-surface/70 text-muted hover:border-fg',
            )}
          >
            <span className={active ? 'text-pen' : 'text-muted'}>{s.icon}</span>
            <span>
              <span className={cx('block text-[15px] font-bold leading-tight', active ? 'text-fg' : 'text-fg/80')}>{s.title}</span>
              <span className="mt-0.5 hidden text-[12.5px] leading-snug text-muted sm:block">{s.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const STAGE_TEXT: Record<ReadProgress['stage'], string> = {
  opening: 'Opening your file…',
  'loading-model': 'Getting the reader ready. First time only…',
  reading: 'Reading your marks…',
  done: 'Done',
};

export function ImportPane({ kind }: { kind: 'photo' | 'pdf' }) {
  const { update } = useStore();
  const [progress, setProgress] = useState<ReadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nothing, setNothing] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camId = useId();
  const fileId = useId();
  const busy = progress != null && progress.stage !== 'done';

  const handle = async (file: File) => {
    setError(null);
    setNothing(false);
    setProgress({ stage: 'opening', progress: 0.03 });
    try {
      const { kind: k, items } = await readMarksFile(file, setProgress);
      const r = importSem3(items);
      const found = Object.keys(r.marks);
      if (!found.length) {
        setNothing(true);
        setProgress(null);
        return;
      }
      update((s) => {
        const marks = { ...s.sem3.marks };
        const hasSplit = found.some((id) => r.marks[id].cia != null && r.marks[id].ese != null && SEM3_SUBJECTS.find((d) => d.id === id)!.eseMax > 0);
        for (const id of found) {
          const m = r.marks[id];
          marks[id] = { ...(marks[id] ?? emptyMark()), total: String(m.total), cia: m.cia != null ? String(m.cia) : '', ese: m.ese != null ? String(m.ese) : '' };
        }
        return {
          ...s,
          sem3Source: 'type',
          sem3: {
            ...s.sem3,
            marks,
            totalOnly: !hasSplit,
            electiveCode: r.electiveCode ?? s.sem3.electiveCode,
            mdcCode: r.mdcCode ?? s.sem3.mdcCode,
          },
          sem3Import: { kind: k, fileName: file.name, filled: Object.fromEntries(found.map((id) => [id, r.marks[id].confidence])), missing: r.missing },
          cardName: s.cardName || titleCase(r.studentName ?? ''),
          cardReg: s.cardReg || (r.regNo ?? ''),
        };
      });
      setProgress(null);
    } catch (e) {
      setProgress(null);
      setError(e instanceof FriendlyParseError ? e.message : "Something went wrong reading that file. Try again, or type your marks in.");
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handle(f);
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) void handle(f);
        }}
        className="rounded-[20px] border-2 border-dashed border-line-strong bg-surface/60 p-5 text-center sm:p-7"
      >
        {busy ? (
          <div aria-live="polite">
            <ScanningSheet progress={progress!.progress} />
            <p className="mt-4 text-[15.5px] font-semibold text-fg">{STAGE_TEXT[progress!.stage]}</p>
            <p className="mt-1 text-[13.5px] text-muted tabular">
              {Math.round(progress!.progress * 100)}% · it stays on your phone
            </p>
          </div>
        ) : (
          <>
            <p className="font-display text-[20px] font-bold tracking-[-0.01em] text-fg">{kind === 'photo' ? 'Show us the result page' : 'Drop in the PDF'}</p>
            <p className="mx-auto mt-1 max-w-sm text-[14px] leading-snug text-muted">
              {kind === 'photo'
                ? 'Lay it flat, fill the frame, no shadows. A screenshot of the result page works best of all.'
                : 'The Sem 3 result page saved as PDF, or your DigiLocker Statement of Grade.'}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              {kind === 'photo' ? (
                <>
                  <input ref={cameraRef} id={camId} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPick} tabIndex={-1} />
                  <input ref={fileRef} id={fileId} type="file" accept="image/*" className="sr-only" onChange={onPick} tabIndex={-1} />
                  <Button onClick={() => cameraRef.current?.click()}>
                    <Camera size={18} aria-hidden="true" />
                    Take a photo
                  </Button>
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    <ImageUp size={18} aria-hidden="true" />
                    Choose a screenshot
                  </Button>
                </>
              ) : (
                <>
                  <input ref={fileRef} id={fileId} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={onPick} tabIndex={-1} />
                  <Button onClick={() => fileRef.current?.click()}>
                    <FileUp size={18} aria-hidden="true" />
                    Choose PDF
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 hidden text-[12.5px] text-faint sm:block">or drag the file here</p>
          </>
        )}
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {nothing && (
        <Notice
          tone="warn"
          action={
            <Button variant="secondary" className="w-full !min-h-11 text-[14px]" onClick={() => update((s) => ({ ...s, sem3Source: 'type' }))}>
              Type them instead
            </Button>
          }
        >
          We couldn't spot any Sem 3 subjects in that file. Make sure the subject codes (like 25CSS06A) are visible, then try again.
        </Notice>
      )}
      {kind === 'photo' && !busy && <p className="text-[13px] leading-snug text-muted">The first photo downloads a small reading model (about 4&nbsp;MB) to your phone. Your photo itself is never sent anywhere.</p>}
    </div>
  );
}

const SHORT: Record<string, string> = Object.fromEntries(SEM3_SUBJECTS.map((s) => [s.id, s.short]));

export function ImportBanner() {
  const { state, update } = useStore();
  const meta = state.sem3Import;
  if (!meta) return null;
  const filled = Object.keys(meta.filled).length;
  const checks = Object.values(meta.filled).filter((c) => c === 'check').length;
  const total = SEM3_SUBJECTS.length;
  const undo = () =>
    update((s) => {
      const marks = { ...s.sem3.marks };
      for (const id of Object.keys(meta.filled)) marks[id] = emptyMark();
      return { ...s, sem3: { ...s.sem3, marks }, sem3Import: null };
    });
  return (
    <Notice
      tone={meta.missing.length || checks ? 'warn' : 'ok'}
      action={
        <Button variant="ghost" className="!min-h-11 w-full text-[14px] sm:w-auto" onClick={undo}>
          <RotateCcw size={16} aria-hidden="true" />
          Undo
        </Button>
      }
    >
      <p className="font-semibold">
        Filled {filled} of {total} papers from your {meta.kind === 'photo' ? 'photo' : 'PDF'}.
      </p>
      <p className="mt-0.5 text-muted">
        Highlighted boxes came from the file. {meta.kind === 'photo' ? 'Cameras can misread digits, so check each one against your sheet.' : 'Give them a quick look before you calculate.'}
        {meta.missing.length > 0 && <> Still to type: {meta.missing.map((id) => SHORT[id]).join(', ')}.</>}
      </p>
    </Notice>
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
