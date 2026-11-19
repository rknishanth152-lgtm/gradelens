import { useId, useMemo, useState } from 'react';
import { ChevronDown, ArrowRight } from 'lucide-react';
import { useStore } from '../state/store';
import { computeSem3, creditsFor, emptyMark, usesSingleField, type MarkInput as MI, type Sem3Input, type Sem3Row } from '../lib/sem3';
import { fmt } from '../lib/grading';
import { ELECTIVE_OPTIONS, MDC_OPTIONS } from '../data/subjects';
import { Button, Card, InfoTip, MarkInput, PassChip, Segmented, Switch, cx } from './ui';
import { ImportBanner, ImportPane, SourcePicker } from './Sem3Import';

type SetInput = (fn: (s: Sem3Input) => Sem3Input) => void;

function SubjectRow({ row, input, setMark, setInput, imported }: { row: Sem3Row; input: Sem3Input; setMark: (id: string, m: Partial<MI>) => void; setInput: SetInput; imported?: 'high' | 'check' }) {
  const def = row.def;
  const m = input.marks[def.id] ?? emptyMark();
  const single = usesSingleField(def, input.totalOnly);
  const selId = useId();
  const otherId = useId();
  const singleLabel = def.ciaMax > 0 && def.eseMax === 0 ? 'Marks (internal only)' : 'Total';
  return (
    <li className="py-4 first:pt-2 last:pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold leading-snug text-fg">{def.options ? def.short : def.name}</p>
          <p className="mt-0.5 text-[13px] text-muted tabular">
            <span translate="no">{row.code}</span>, {row.credits} {row.credits === 1 ? 'credit' : 'credits'}
            {!def.counted && ', not in SGPA'}
          </p>
        </div>
        <PassChip state={row.state} />
      </div>

      {def.options && (
        <div className="mt-3">
          <label htmlFor={selId} className="sr-only">
            Which {def.short} did you take?
          </label>
          <select
            id={selId}
            className="field text-[15.5px]"
            value={def.id === 'elective' ? input.electiveCode : input.mdcCode}
            onChange={(e) => {
              const v = e.target.value;
              setInput((s) => (def.id === 'elective' ? { ...s, electiveCode: v } : { ...s, mdcCode: v }));
            }}
          >
            {(def.id === 'elective' ? ELECTIVE_OPTIONS : MDC_OPTIONS).map((o) => (
              <option key={o.code} value={o.code}>
                {o.name === 'Other' ? 'Something else' : o.name}
              </option>
            ))}
          </select>
          {def.id === 'mdc' && input.mdcCode === '25MDCxx' && (
            <div className="mt-2">
              <label htmlFor={otherId} className="sr-only">
                Name of your MDC
              </label>
              <input id={otherId} name="mdc-name" className="field text-[15.5px]" placeholder="Its name, if you like…" autoComplete="off" value={input.mdcOtherName} onChange={(e) => setInput((s) => ({ ...s, mdcOtherName: e.target.value }))} />
            </div>
          )}
        </div>
      )}

      <div className={cx('mt-3 grid gap-3', single ? 'grid-cols-1' : 'grid-cols-2')}>
        {single ? (
          <MarkInput id={`m-${def.id}-total`} label={`${def.short}: ${singleLabel.toLowerCase()}`} hideLabel value={m.total} max={def.totalMax} error={row.errors.total} onChange={(v) => setMark(def.id, { total: v })} placeholder={`${singleLabel}…`} imported={imported} />
        ) : (
          <>
            <MarkInput id={`m-${def.id}-cia`} label="Internal (CIA)" value={m.cia} max={def.ciaMax} error={row.errors.cia} onChange={(v) => setMark(def.id, { cia: v })} placeholder="CIA…" imported={imported} />
            <MarkInput id={`m-${def.id}-ese`} label="External (ESE)" value={m.ese} max={def.eseMax} error={row.errors.ese} onChange={(v) => setMark(def.id, { ese: v })} placeholder="ESE…" imported={imported} />
          </>
        )}
      </div>
      {!single && (
        <p className="mt-2 text-[13.5px] text-muted tabular">
          Total <span className="font-semibold text-fg">{row.total != null ? row.total : '–'}</span> / {def.totalMax}
        </p>
      )}
      {row.total != null && row.counted && row.state !== 'fail' && (
        <p className="hand mt-1.5 text-[15px] leading-snug text-pen tabular">
          {fmt(row.gradePoint, 1)} × {row.credits} = {fmt(row.creditPoints, 1)} points
        </p>
      )}
      {row.state === 'fail' && <p className="mt-1.5 text-[13.5px] text-fail">Under the pass mark, so this paper adds 0 credits and 0 points for now.</p>}
    </li>
  );
}

const CREDIT_CHOICES = [0, 1, 2, 3, 4, 5];

export function Sem3Form({ onCalculate, submitLabel = 'Work out my SGPA' }: { onCalculate: () => void; submitLabel?: string }) {
  const { state, update } = useStore();
  const input = state.sem3;
  const result = useMemo(() => computeSem3(input), [input]);
  const [advanced, setAdvanced] = useState(false);
  const nptelNameId = useId();
  const imported = state.sem3Import?.filled ?? {};

  const setInput: SetInput = (fn) => update((s) => ({ ...s, sem3: fn(s.sem3) }));
  const setMark = (id: string, patch: Partial<MI>) =>
    update((s) => {
      const filled = s.sem3Import ? { ...s.sem3Import.filled } : null;
      if (filled) delete filled[id];
      return {
        ...s,
        sem3: { ...s.sem3, marks: { ...s.sem3.marks, [id]: { ...(s.sem3.marks[id] ?? emptyMark()), ...patch } } },
        sem3Import: s.sem3Import && filled ? { ...s.sem3Import, filled } : s.sem3Import,
      };
    });

  const rowsBy = (ids: string[]) => result.rows.filter((r) => ids.includes(r.def.id));
  const groups: Array<{ title: string; note?: string; rows: Sem3Row[] }> = [
    { title: 'Core papers and practicals', rows: rowsBy(['rdbms', 'sql', 'se', 'testing', 'iot']) },
    { title: 'Elective, maths and MDC', note: 'MDC counts for SGPA but not for the percentage.', rows: rowsBy(['elective', 'or', 'mdc']) },
    { title: 'Capstone project', note: 'Counts for the percentage, not for SGPA.', rows: rowsBy(['capstone']) },
  ];
  const nptelRow = result.rows.find((r) => r.def.id === 'nptel');
  const hasErrors = result.rows.some((r) => Object.keys(r.errors).length);
  const status = hasErrors
    ? 'Fix the marks in red first'
    : result.missing > 0
      ? `${result.missing} ${result.missing === 1 ? 'paper' : 'papers'} left to fill`
      : `All in: ${result.totals.credits} counted credits, ${result.percentObtained} / ${result.percentMax} marks`;

  const source = state.sem3Source;

  return (
    <div className="space-y-4">
      <SourcePicker />

      {source !== 'type' ? (
        <ImportPane kind={source} />
      ) : (
        <>
          <ImportBanner />
          <Card className="px-4 py-3 sm:px-6">
            <Switch
              checked={input.totalOnly}
              onChange={(v) => setInput((s) => ({ ...s, totalOnly: v }))}
              label="I only know the totals"
              description={input.totalOnly ? 'Copy the TOTAL column from the result page.' : 'Type internal and external marks; we add them up.'}
            />
          </Card>

          {groups.map((g) => (
            <Card key={g.title} className="px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
              <h2 className="text-[19px] font-bold tracking-[-0.01em] text-fg">{g.title}</h2>
              {g.note && <p className="mt-0.5 text-[13.5px] text-muted">{g.note}</p>}
              <ul className="mt-1 divide-y-[1.5px] divide-dashed divide-line">
                {g.rows.map((r) => (
                  <SubjectRow key={r.def.id} row={r} input={input} setMark={setMark} setInput={setInput} imported={imported[r.def.id]} />
                ))}
              </ul>
            </Card>
          ))}

          <Card className="px-4 py-3 sm:px-6">
            <Switch checked={input.nptelOn} onChange={(v) => setInput((s) => ({ ...s, nptelOn: v }))} label="I did an NPTEL course" description="Optional. It adds to your SGPA, and the percentage becomes out of 650." />
            {input.nptelOn && nptelRow && (
              <div>
                <div className="mt-3 grid gap-3 border-t-[1.5px] border-dashed border-line pt-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={nptelNameId} className="mb-1.5 block text-[13.5px] font-medium text-muted">
                      Course name (optional)
                    </label>
                    <input id={nptelNameId} name="nptel-name" className="field text-[15.5px]" autoComplete="off" placeholder="e.g. Cloud Computing…" value={input.nptelName} onChange={(e) => setInput((s) => ({ ...s, nptelName: e.target.value }))} />
                  </div>
                  <div>
                    <p className="mb-1.5 block text-[13.5px] font-medium text-muted">Credits</p>
                    <Segmented size="sm" label="NPTEL credits" value={String(creditsFor(nptelRow.def, input))} onChange={(v) => setInput((s) => ({ ...s, credits: { ...s.credits, nptel: Number(v) } }))} options={['1', '2', '3', '4'].map((c) => ({ value: c, label: c }))} />
                  </div>
                </div>
                <ul>
                  <SubjectRow row={nptelRow} input={input} setMark={setMark} setInput={setInput} />
                </ul>
              </div>
            )}
          </Card>

          <Card className="px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[15.5px] font-semibold text-fg">Spoken Hindi or Basic Tamil</p>
                <p className="text-[13.5px] text-muted">No credits, so it changes nothing. Optional.</p>
              </div>
              <div className="w-full sm:w-72">
                <Segmented
                  size="sm"
                  label="Spoken Hindi or Basic Tamil result"
                  value={input.ancPassed == null ? 'skip' : input.ancPassed ? 'pass' : 'fail'}
                  onChange={(v) => setInput((s) => ({ ...s, ancPassed: v === 'skip' ? null : v === 'pass' }))}
                  options={[
                    { value: 'pass', label: 'Cleared' },
                    { value: 'fail', label: 'Not yet' },
                    { value: 'skip', label: 'Skip' },
                  ]}
                />
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 text-left sm:px-6">
              <span className="text-[15.5px] font-semibold text-fg">Change credits</span>
              <ChevronDown size={18} className={cx('text-muted transition-transform duration-200', advanced && 'rotate-180')} aria-hidden="true" />
            </button>
            {advanced && (
              <div className="border-t-[1.5px] border-dashed border-line px-4 pb-5 pt-3 sm:px-6">
                <p className="flex items-center text-[13.5px] text-muted">
                  These are estimates
                  <InfoTip text="The Sem 3 result page doesn't print credits. These defaults (19 counted credits) follow the syllabus; change them if your statement says otherwise." label="About estimated credits" />
                </p>
                <ul className="mt-1 grid gap-2 sm:grid-cols-2">
                  {result.rows
                    .filter((r) => r.def.id !== 'nptel')
                    .map((r) => {
                      const id = `cr-${r.def.id}`;
                      return (
                        <li key={r.def.id} className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-line px-3 py-2">
                          <label htmlFor={id} className="min-w-0 truncate text-[14.5px] text-fg">
                            {r.def.short}
                            {!r.counted && <span className="text-faint"> (not counted)</span>}
                          </label>
                          <select id={id} className="field !min-h-11 !w-20 !rounded-xl !px-3 text-[15.5px] tabular" value={r.credits} onChange={(e) => setInput((s) => ({ ...s, credits: { ...s.credits, [r.def.id]: Number(e.target.value) } }))}>
                            {CREDIT_CHOICES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </li>
                      );
                    })}
                </ul>
                <button type="button" className="mt-3 min-h-11 cursor-pointer text-[14px] font-semibold text-pen underline-offset-4 hover:underline" onClick={() => setInput((s) => ({ ...s, credits: {} }))}>
                  Back to the default credits
                </button>
              </div>
            )}
          </Card>
        </>
      )}

      {source === 'type' && (
        <div className="safe-bottom sticky bottom-0 z-20 -mx-4 border-t-[1.5px] border-dashed border-line-strong bg-bg/90 px-4 pt-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-2 sm:backdrop-blur-none">
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className={cx('text-center text-[13.5px] sm:text-left', hasErrors ? 'text-fail' : 'text-muted')} role="status">
              {status}
            </p>
            <Button onClick={onCalculate} disabled={!result.valid} className="w-full sm:w-auto sm:min-w-60">
              {submitLabel}
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
