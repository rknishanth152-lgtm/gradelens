import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useStore } from '../state/store';
import { IconOnDevice, IconStampMark, IconStopwatch, SpotAllSems, SpotThisSem, Stamp, HandTick } from '../components/art';
import { cx } from '../components/ui';

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** The hero: a torn-off marks slip with a lens reading one row. */
function HeroSlip() {
  const reduce = useReducedMotion();
  const d = (s: number) => (reduce ? 0 : s);
  const rows: Array<[string, string, string?]> = [
    ['Relational Database Mgmt. Systems', '32 / 50'],
    ['Operations Research', '75 / 100', 'lens'],
    ['Internet of Things', '28 / 50'],
    ['Capstone Project', '83 / 100', 'struck'],
  ];
  return (
    <figure className="relative mx-auto w-full max-w-[460px]">
      <div className="sheet perforated-top relative overflow-hidden rounded-b-[22px] rounded-t-md pb-6 pt-7">
        <div className="ruled pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative pl-[54px] pr-5">
          <p className="hand text-[17px] leading-7 text-muted">Sem 3, Oct 2026</p>
          <ul className="mt-1">
            {rows.map(([name, marks, kind]) => (
              <li key={name} className="relative flex h-14 items-center justify-between gap-3">
                <span className={cx('min-w-0 truncate text-[15px] font-semibold text-fg', kind === 'struck' && 'text-muted', kind === 'lens' && 'marked pr-[104px] sm:pr-0')}>{name}</span>
                <span className={cx('num shrink-0 text-[19px] font-bold text-fg', kind === 'struck' && 'text-muted', kind === 'lens' && 'invisible')}>{marks}</span>
                {kind === 'lens' && (
                  <motion.div
                    className="absolute -right-3 top-1/2 z-10 -mt-[48px]"
                    initial={{ opacity: 0, transform: reduce ? 'translate(0px,0px)' : 'translate(-60px,-56px)' }}
                    animate={{ opacity: 1, transform: 'translate(0px,0px)' }}
                    transition={{ delay: d(0.25), duration: d(0.7), ease: EASE_OUT }}
                    aria-hidden="true"
                  >
                    <div className="relative flex h-[96px] w-[96px] flex-col items-center justify-center rounded-full border-[5px] border-pen-strong bg-surface shadow-[0_12px_28px_-12px_rgba(18,28,58,0.5)]">
                      <span className="num text-[30px] font-extrabold leading-none text-fg">75</span>
                      <span className="num text-[12px] font-semibold text-muted">out of 100</span>
                      <span className="absolute -bottom-[30px] -right-[18px] h-[40px] w-[11px] origin-top rotate-[-42deg] rounded-full bg-pen-strong" />
                    </div>
                  </motion.div>
                )}
                {kind === 'struck' && (
                  <svg className="pointer-events-none absolute -left-2 right-0 top-1/2 h-3 w-[calc(100%+8px)] -translate-y-1/2" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden="true">
                    <path d="M2 6 C 50 3, 120 8, 198 4" stroke="var(--fail)" strokeWidth="2.2" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
          <motion.p
            className="hand mt-1 text-[17px] leading-7 text-pen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: d(0.8), duration: d(0.3) }}
          >
            OR: 75/100 = 7.5, × 4 credits = 30 points
          </motion.p>
          <p className="hand pr-[84px] text-[15.5px] leading-7 text-fail">Capstone counts for %, not for SGPA</p>
        </div>
      </div>
      <motion.div className="absolute -bottom-8 -right-2 sm:-right-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d(1), duration: d(0.25) }}>
        <Stamp top="CHECKED WITH" bottom="COLLEGE RULES" centre="7.38" size={96} color="var(--pass)" rotate={-14} />
      </motion.div>
      <figcaption className="sr-only">Example: 75 out of 100 in Operations Research is a 7.5 grade point. Times 4 credits, that is 30 credit points. Capstone counts towards the percentage but not the SGPA.</figcaption>
    </figure>
  );
}

function Journey({ title, kicker, body, time, art, onClick, primary }: { title: string; kicker: string; body: string; time: string; art: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'press group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[22px] border-[1.5px] p-5 text-left sm:p-6',
        primary ? 'border-fg bg-surface shadow-[5px_5px_0_0_var(--offset)] hover:shadow-[3px_3px_0_0_var(--offset)]' : 'border-line-strong bg-surface hover:border-fg',
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="hand block text-[17px] leading-tight text-pen">{kicker}</span>
          <span className="mt-1 block font-display text-[27px] font-extrabold leading-[1.05] tracking-[-0.03em] text-fg sm:text-[30px]">{title}</span>
        </span>
        <span className="-mr-2 -mt-2 h-[86px] w-[110px] shrink-0">{art}</span>
      </span>
      <span className="mt-3 block max-w-[34rem] text-[15px] leading-relaxed text-muted">{body}</span>
      <span className="mt-5 flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-line-strong pt-4">
        <span className="text-[13.5px] font-medium text-muted">{time}</span>
        <span className={cx('inline-flex h-11 items-center gap-1.5 rounded-xl px-4 text-[14.5px] font-semibold', primary ? 'bg-pen-strong text-on-pen' : 'border-[1.5px] border-line-strong text-fg')}>
          Start
          <ArrowRight size={17} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </span>
    </button>
  );
}

function Proof() {
  const items = [
    { icon: <IconOnDevice size={26} />, title: 'Stays on your phone', body: 'Marks, PDFs and photos are read right here. Nothing is uploaded.' },
    { icon: <IconStampMark size={26} />, title: 'Matches real marksheets', body: "Checked against four classmates' official SGPAs and CGPAs." },
    { icon: <IconStopwatch size={26} />, title: 'Done in a minute', body: 'Copy the totals, or point your camera at the result page.' },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-3" aria-label="Why you can trust it">
      {items.map((i) => (
        <li key={i.title} className="flex gap-3 rounded-[18px] border-[1.5px] border-line bg-surface/70 p-4">
          <span className="mt-0.5 text-pen">{i.icon}</span>
          <span>
            <span className="block text-[15px] font-semibold text-fg">{i.title}</span>
            <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{i.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function WhatCounts() {
  const counted = ['Core papers and practicals (CSS)', 'Maths (MCU)', 'Your elective (CTU)', 'Multidisciplinary course (MDC)', 'NPTEL, if you took one'];
  const skipped = ['Tamil, Hindi or French', 'English', 'EVS', 'Indian Knowledge System', 'Capstone project', 'Spoken Hindi or Basic Tamil'];
  return (
    <section aria-labelledby="counts" className="sheet relative overflow-hidden rounded-[22px] p-5 sm:p-7">
      <h2 id="counts" className="text-[24px] font-extrabold tracking-[-0.02em] text-fg sm:text-[28px]">
        What the college actually counts
      </h2>
      <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-muted">Your SGPA only looks at some papers. Grade point is marks out of 10, multiplied by the paper's credits.</p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="text-[16px] font-bold text-fg">Counted</h3>
          <ul className="mt-2 space-y-2">
            {counted.map((c) => (
              <li key={c} className="flex items-center gap-2.5 text-[15px] text-fg">
                <HandTick size={19} />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-[16px] font-bold text-fg">Left out</h3>
          <ul className="mt-2 space-y-2">
            {skipped.map((c) => (
              <li key={c} className="relative w-fit text-[15px] text-muted">
                {c}
                <svg className="pointer-events-none absolute -left-1 top-1/2 h-2.5 w-[calc(100%+8px)] -translate-y-1/2" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M1 6 C 30 3, 70 8, 99 4" stroke="var(--fail)" strokeWidth="2" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                </svg>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 grid gap-3 border-t-[1.5px] border-dashed border-line-strong pt-5 text-[14.5px] leading-snug text-muted sm:grid-cols-2">
        <p>
          <span className="font-semibold text-fg">Failed a paper?</span> It drops out completely: no credits, no points, until you clear it.
        </p>
        <p>
          <span className="font-semibold text-fg">CGPA isn't an average of SGPAs.</span> It's weighted by credits, so a 19-credit semester moves it more than a 12-credit one.
        </p>
      </div>
    </section>
  );
}

export function Landing() {
  const { go, update } = useStore();
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <div className="grid gap-10 pt-8 sm:pt-12 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-x-14 lg:gap-y-14 lg:pt-16">
        <div className="order-1 lg:pt-4">
          <h1 className="text-[42px] font-extrabold leading-[0.98] tracking-[-0.045em] text-fg sm:text-[60px] lg:text-[72px]">Read your marks the way the exam cell does.</h1>
          <p className="mt-5 max-w-[33rem] text-[17px] leading-relaxed text-muted">
            The result page shows marks. GradeLens turns them into your SGPA, CGPA and percentage with the college's own rules. Type them in, photograph the page, or drop in the DigiLocker PDF.
          </p>
        </div>

        <div className="order-3 pb-10 lg:order-2 lg:pb-6">
          <HeroSlip />
        </div>

        <section aria-label="Choose what to work out" className="order-2 grid gap-4 pr-1.5 lg:order-3 lg:col-span-2 lg:grid-cols-2 lg:gap-5">
          <Journey
            primary
            kicker="Just this semester"
            title="Sem 3 SGPA"
            body="Your Oct 2026 SGPA and percentage, paper by paper. Type the marks, snap the result page, or upload the PDF."
            time="About 30 seconds"
            art={<SpotThisSem className="h-full w-full" />}
            onClick={() => {
              update((s) => ({ ...s, sgpaShowResult: false }));
              go('sgpa');
            }}
          />
          <Journey
            kicker="Since day one"
            title="CGPA after Sem 3"
            body="Add your Sem 1 and Sem 2 sheets to see your CGPA, how it's trending, and what each coming semester needs."
            time="About a minute"
            art={<SpotAllSems className="h-full w-full" />}
            onClick={() => go('cgpa')}
          />
        </section>
      </div>

      <div className="mt-14 space-y-6 sm:mt-20">
        <Proof />
        <WhatCounts />
      </div>
    </div>
  );
}
