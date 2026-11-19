import { useEffect, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { PencilLine } from 'lucide-react';
import { useStore } from '../state/store';
import { computeSem3 } from '../lib/sem3';
import { computePrev } from '../lib/prevSem';
import { cgpa as cgpaOf, fmt, roundHalfUp } from '../lib/grading';
import { celebrate } from '../lib/celebrate';
import { PrevSemStep } from '../components/PrevSemStep';
import { Sem3Form } from '../components/Sem3Form';
import { CountUp, remarkFor } from '../components/Numbers';
import { TrendChart } from '../components/TrendChart';
import { TargetPlanner } from '../components/TargetPlanner';
import { ResultCardActions } from '../components/ResultCard';
import { Breakdown } from '../components/Breakdown';
import { HandTick, Protractor } from '../components/art';
import { Button, Card, cx } from '../components/ui';
import { PageTitle } from './SgpaFlow';

const STEPS = ['Sem 1', 'Sem 2', 'Sem 3', 'Result'];

/** Binder-tab stepper. */
function Stepper({ step, done, onJump }: { step: number; done: boolean[]; onJump: (i: number) => void }) {
  return (
    <nav aria-label="Progress" className="mb-5">
      <ol className="grid grid-cols-4 gap-1.5">
        {STEPS.map((s, i) => {
          const reachable = i === 0 || done.slice(0, i).every(Boolean);
          const current = i === step;
          return (
            <li key={s}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(i)}
                aria-current={current ? 'step' : undefined}
                className={cx(
                  'press flex min-h-12 w-full cursor-pointer items-center justify-center gap-1.5 rounded-t-[14px] rounded-b-md border-[1.5px] border-b-[3px] text-[14px] font-semibold disabled:cursor-not-allowed',
                  current ? 'border-fg bg-surface text-fg' : done[i] ? 'border-line-strong bg-surface/70 text-fg' : reachable ? 'border-line bg-surface/50 text-muted hover:text-fg' : 'border-line bg-transparent text-faint',
                )}
              >
                {done[i] && !current ? <HandTick size={16} /> : <span className="num text-[13px] opacity-70">{i + 1}</span>}
                {s}
                <span className="sr-only">{done[i] ? ', done' : ''}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CgpaResult() {
  const { state, update } = useStore();
  const reduce = useReducedMotion();
  const p1 = useMemo(() => computePrev(1, state.prev[1]), [state.prev]);
  const p2 = useMemo(() => computePrev(2, state.prev[2]), [state.prev]);
  const s3 = useMemo(() => computeSem3(state.sem3), [state.sem3]);
  const sems = [p1, p2, s3.totals];
  const cg = cgpaOf(sems);
  const cp = sems.reduce((a, s) => a + s.creditPoints, 0);
  const cr = sems.reduce((a, s) => a + s.credits, 0);
  const sheet = state.prev[1].sheet ?? state.prev[2].sheet;

  useEffect(() => {
    if (cg >= 8 || s3.totals.sgpa >= 8) void celebrate(`cgpa-${fmt(cg, 2)}-${fmt(s3.totals.sgpa, 2)}`, 900);
  }, [cg, s3.totals.sgpa]);

  const srcLabel = (s: typeof p1) => (s.source === 'pdf' ? (s.verification?.status === 'verified' ? 'from PDF, verified' : 'from PDF') : s.source === 'quick' ? 'from official SGPA' : 'from your marks');

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6 sm:p-9">
        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
          <div className="flex flex-col items-center text-center">
            <Protractor value={cg} label="CGPA after Sem 3" />
            <p className="-mt-1 text-[15px] font-semibold text-muted">CGPA after Sem 3</p>
            <p className="text-[84px] leading-[0.95] text-fg sm:text-[96px]" aria-live="polite">
              <CountUp value={cg} className="font-extrabold tracking-[-0.05em]" duration={900} />
            </p>
            <p className="mt-2 text-[14.5px] text-muted">
              On the marksheet <span className="num text-[18px] font-bold text-fg">{roundHalfUp(cg, 1).toFixed(1)}</span>
            </p>
            <motion.p className="hand mt-2 -rotate-2 text-[21px] text-pen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: reduce ? 0 : 1, duration: 0.3 }}>
              {remarkFor(cg)}
            </motion.p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-[1.5px] border-line bg-surface-2 p-4">
              <dt className="text-[13.5px] text-muted">Sem 3 SGPA</dt>
              <dd className="mt-1 text-[28px] leading-none text-fg sm:text-[34px]">
                <CountUp value={s3.totals.sgpa} className="font-extrabold" />
              </dd>
              <dd className="mt-1.5 text-[13px] text-muted">marksheet {roundHalfUp(s3.totals.sgpa, 1).toFixed(1)}</dd>
            </div>
            <div className="rounded-2xl border-[1.5px] border-line bg-surface-2 p-4">
              <dt className="text-[13.5px] text-muted">Percentage</dt>
              <dd className="mt-1 text-[28px] leading-none text-fg sm:text-[34px]">
                <span className="marked">
                  <CountUp value={s3.percentage} className="font-extrabold" suffix="%" />
                </span>
              </dd>
              <dd className="mt-1.5 text-[13px] text-muted tabular">
                {s3.percentObtained} / {s3.percentMax}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border-[1.5px] border-dashed border-line-strong p-4 text-[14px] leading-snug text-muted tabular">
              {fmt(cp, 1)} credit points ÷ {cr} credits across three semesters. Weighted by credits, not an average of SGPAs.
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1.15fr_1fr]">
        <Card className="p-5 sm:p-6">
          <TrendChart values={sems.map((s) => s.sgpa)} />
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="text-[21px] font-bold tracking-[-0.01em] text-fg">Each semester</h2>
          <ul className="mt-3 divide-y-[1.5px] divide-dashed divide-line">
            {sems.map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[15.5px] font-semibold text-fg">Semester {i + 1}</p>
                  <p className="text-[13px] text-muted tabular">
                    {fmt(s.creditPoints, 1)} points, {s.credits} credits, {i < 2 ? srcLabel(s as typeof p1) : 'from your marks'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="num text-[24px] font-extrabold text-fg">{fmt(s.sgpa, 2)}</span>
                  <button type="button" onClick={() => update((st) => ({ ...st, cgpaStep: i }))} aria-label={`Edit semester ${i + 1}`} className="press inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-fg">
                    <PencilLine size={17} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <TargetPlanner currentCP={cp} currentCredits={cr} />

      <ResultCardActions cgpa={cg} sgpa={s3.totals.sgpa} percentage={s3.percentage} defaultName={titleCase(sheet?.studentName ?? '')} defaultReg={sheet?.regNo ?? ''} />

      <Card className="overflow-hidden">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-[16px] font-semibold text-fg sm:px-6">
            Sem 3, paper by paper
            <span className="text-[14px] font-medium text-pen group-open:hidden">Show</span>
            <span className="hidden text-[14px] font-medium text-pen group-open:inline">Hide</span>
          </summary>
          <div className="border-t-[1.5px] border-dashed border-line p-4 sm:p-6">
            <Breakdown rows={s3.rows} totals={s3.totals} />
          </div>
        </details>
      </Card>
    </div>
  );
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

export function CgpaFlow() {
  const { state, update, go } = useStore();
  const reduce = useReducedMotion();
  const step = Math.min(Math.max(state.cgpaStep, 0), 3);
  const p1 = computePrev(1, state.prev[1]).valid;
  const p2 = computePrev(2, state.prev[2]).valid;
  const s3 = useMemo(() => computeSem3(state.sem3).valid, [state.sem3]);
  const done = [p1, p2, s3, p1 && p2 && s3];
  const setStep = (i: number) => {
    update((s) => ({ ...s, cgpaStep: i }));
    window.scrollTo({ top: 0 });
  };

  const safeStep = step === 3 && !(p1 && p2 && s3) ? done.findIndex((d) => !d) : step;
  const prevStep = useRef(safeStep);
  const dir = safeStep >= prevStep.current ? 1 : -1;
  useEffect(() => {
    prevStep.current = safeStep;
  }, [safeStep]);

  const titles = [
    ['Semester 1', 'Your Nov 2025 Statement of Grade, or just the SGPA printed on it.'],
    ['Semester 2', 'Your Apr 2026 Statement of Grade, or just the SGPA printed on it.'],
    ['Semester 3', "Your Oct 2026 marks. If you've already added them, they're here."],
    ['Your CGPA', ''],
  ];

  return (
    <div className={cx('mx-auto w-full px-4 sm:px-6', safeStep === 3 ? 'max-w-5xl' : 'max-w-3xl')}>
      <PageTitle title={titles[safeStep][0]} sub={titles[safeStep][1] || undefined} onBack={() => (safeStep === 0 ? go('landing') : setStep(safeStep - 1))} backLabel={safeStep === 0 ? 'Home' : 'Back'} />
      <Stepper step={safeStep} done={done} onJump={setStep} />
      <motion.div
        key={safeStep}
        initial={{ opacity: 0, transform: reduce ? 'translateX(0px)' : `translateX(${dir * 24}px)` }}
        animate={{ opacity: 1, transform: 'translateX(0px)' }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      >
        {safeStep === 0 && <PrevSemStep sem={1} onBack={() => go('landing')} onNext={() => setStep(1)} />}
        {safeStep === 1 && <PrevSemStep sem={2} onBack={() => setStep(0)} onNext={() => setStep(2)} />}
        {safeStep === 2 && <Sem3Form submitLabel="Show my CGPA" onCalculate={() => setStep(3)} />}
        {safeStep === 3 && <CgpaResult />}
      </motion.div>
      {safeStep === 3 && (
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={() => setStep(0)}>
            Go back to Sem 1
          </Button>
        </div>
      )}
    </div>
  );
}
