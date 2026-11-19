import { useEffect, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, PencilLine } from 'lucide-react';
import { useStore } from '../state/store';
import { computeSem3 } from '../lib/sem3';
import { fmt, roundHalfUp } from '../lib/grading';
import { celebrate } from '../lib/celebrate';
import { Sem3Form } from '../components/Sem3Form';
import { Breakdown } from '../components/Breakdown';
import { CountUp, remarkFor } from '../components/Numbers';
import { PenCircle } from '../components/art';
import { Button, Card } from '../components/ui';

export function PageTitle({ title, sub, onBack, backLabel = 'Back' }: { title: string; sub?: string; onBack?: () => void; backLabel?: string }) {
  return (
    <div className="pb-5 pt-5 sm:pt-9">
      {onBack && (
        <button type="button" onClick={onBack} className="-ml-2 mb-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl px-2 text-[14.5px] font-semibold text-muted hover:text-fg">
          <ArrowLeft size={17} aria-hidden="true" />
          {backLabel}
        </button>
      )}
      <h1 className="text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em] text-fg sm:text-[46px]">{title}</h1>
      {sub && <p className="mt-2 max-w-xl text-[16px] leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}

/** The reveal: one lead (the number + its pen circle), everything else is already there. */
export function ScoreReveal({ label, value, note }: { label: string; value: number; note?: string }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <p className="text-[15px] font-semibold text-muted">{label}</p>
      <div className="relative mt-2 inline-block px-5 py-2">
        <PenCircle className="pointer-events-none absolute -inset-x-3 -inset-y-2 h-[calc(100%+16px)] w-[calc(100%+24px)]" delay={0.55} />
        <span className="block text-[96px] leading-[0.92] text-fg sm:text-[124px]" aria-live="polite">
          <CountUp value={value} className="font-extrabold tracking-[-0.05em]" duration={900} />
        </span>
      </div>
      {note && (
        <motion.p
          className="hand mt-3 -rotate-2 text-[22px] leading-tight text-pen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: reduce ? 0 : 1.1, duration: 0.3 }}
        >
          {note}
        </motion.p>
      )}
    </div>
  );
}

function SgpaResult() {
  const { state, update, go } = useStore();
  const r = useMemo(() => computeSem3(state.sem3), [state.sem3]);
  const sgpa = r.totals.sgpa;

  useEffect(() => {
    if (sgpa >= 8) void celebrate(`sgpa-${fmt(sgpa, 2)}`, 1100);
  }, [sgpa]);

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden p-6 sm:p-9">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <ScoreReveal label="Your Sem 3 SGPA" value={sgpa} note={remarkFor(sgpa)} />
            <p className="mt-4 text-[14.5px] text-muted">
              On the marksheet it would read <span className="num text-[19px] font-bold text-fg">{roundHalfUp(sgpa, 1).toFixed(1)}</span>
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-[1.5px] border-line bg-surface-2 p-4">
              <dt className="text-[13.5px] text-muted">Percentage</dt>
              <dd className="mt-1 text-[28px] leading-none text-fg sm:text-[32px]">
                <span className="marked">
                  <CountUp value={r.percentage} className="font-extrabold" suffix="%" />
                </span>
              </dd>
            </div>
            <div className="rounded-2xl border-[1.5px] border-line bg-surface-2 p-4">
              <dt className="text-[13.5px] text-muted">Marks</dt>
              <dd className="num mt-1 text-[28px] font-extrabold leading-none text-fg sm:text-[32px]">
                {r.percentObtained}
                <span className="text-[16px] font-semibold text-faint"> / {r.percentMax}</span>
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border-[1.5px] border-dashed border-line-strong p-4 text-[14px] leading-snug text-muted tabular">
              {fmt(r.totals.creditPoints, 1)} credit points ÷ {r.totals.credits} counted credits = {fmt(sgpa, 2)}
            </div>
          </dl>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="mb-2 text-[21px] font-bold tracking-[-0.01em] text-fg">Paper by paper</h2>
        <Breakdown rows={r.rows} totals={r.totals} />
        <p className="mt-3 text-[13px] text-muted">Sem 3 credits are estimated. Language papers and the capstone stay out of SGPA, same as the official sheet.</p>
      </Card>

      <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[19px] font-bold text-fg">Want the full picture?</p>
          <p className="text-[14.5px] text-muted">Your Sem 3 marks are saved. Add Sem 1 and 2 to get your CGPA.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => update((s) => ({ ...s, sgpaShowResult: false }))}>
            <PencilLine size={17} aria-hidden="true" />
            Change marks
          </Button>
          <Button
            onClick={() => {
              update((s) => ({ ...s, cgpaStep: 0 }));
              go('cgpa');
            }}
          >
            Add Sem 1 and 2
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export function SgpaFlow() {
  const { state, update, go } = useStore();
  const show = state.sgpaShowResult;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <PageTitle
        title={show ? 'Here’s your Sem 3' : 'Sem 3 SGPA'}
        sub={show ? undefined : 'Add your Oct 2026 marks any way you like. You can check every number before we work it out.'}
        onBack={() => (show ? update((s) => ({ ...s, sgpaShowResult: false })) : go('landing'))}
        backLabel={show ? 'Change marks' : 'Home'}
      />
      <motion.div key={show ? 'r' : 'f'} initial={{ opacity: 0, transform: 'translateY(8px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
        {show ? (
          <SgpaResult />
        ) : (
          <Sem3Form
            onCalculate={() => {
              update((s) => ({ ...s, sgpaShowResult: true }));
              window.scrollTo({ top: 0 });
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
