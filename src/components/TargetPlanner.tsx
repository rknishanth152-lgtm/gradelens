import { useId, useMemo } from 'react';
import { useStore } from '../state/store';
import { fmt, targetPlanner } from '../lib/grading';
import { HandCross, HandTick } from './art';
import { Card, cx } from './ui';

export function TargetPlanner({ currentCP, currentCredits }: { currentCP: number; currentCredits: number }) {
  const { state, update } = useStore();
  const sliderId = useId();
  const crId = useId();
  const target = state.plannerTarget;
  const per = state.futureCredits;
  const plan = useMemo(() => targetPlanner({ currentCP, currentCredits, target, remainingSems: 3, creditsPerSem: per }), [currentCP, currentCredits, target, per]);
  const f = plan.final;
  const already = f.required <= 0;

  return (
    <Card className="p-5 sm:p-7">
      <h2 className="text-[21px] font-bold tracking-[-0.01em] text-fg">Where do you want to finish?</h2>
      <p className="mt-1 text-[14.5px] text-muted">Pick a CGPA for the end of Sem 6. We'll tell you the average you need from here.</p>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor={sliderId} className="text-[15px] font-semibold text-fg">
            Final CGPA I'm aiming for
          </label>
          <output htmlFor={sliderId} className="num text-[34px] font-extrabold text-fg">
            {target.toFixed(1)}
          </output>
        </div>
        <input
          id={sliderId}
          name="target-cgpa"
          type="range"
          min={5}
          max={10}
          step={0.1}
          value={target}
          onChange={(e) => update((s) => ({ ...s, plannerTarget: Number(e.target.value) }))}
          className="range mt-1 h-11 w-full cursor-pointer"
          style={{ ['--fill' as string]: `${((target - 5) / 5) * 100}%` }}
          aria-valuetext={`Target CGPA ${target.toFixed(1)}`}
        />
        <div className="flex justify-between text-[12.5px] text-faint tabular" aria-hidden="true">
          <span>5.0</span>
          <span>7.5</span>
          <span>10.0</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-surface-2 p-5" role="status">
        {already ? (
          <p className="text-[16px] leading-snug text-fg">
            You're already above {target.toFixed(1)}. Keep each semester above <strong className="num marked">{fmt(Math.max(f.required, 0), 2)}</strong> and you'll stay there.
          </p>
        ) : f.reachable ? (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[14px] text-muted">Average SGPA you need in Sem 4, 5 and 6</p>
              <p className="num mt-1 text-[52px] font-extrabold leading-none text-fg">
                <span className="marked">{fmt(f.required, 2)}</span>
              </p>
            </div>
            <p className="hand max-w-[15rem] -rotate-1 text-[19px] leading-tight text-pen">
              {f.required > 9.5 ? 'Tough, but on the table.' : f.required > plan.currentCgpa + 0.5 ? 'A real step up. Doable.' : 'Keep doing what you are doing.'}
            </p>
          </div>
        ) : (
          <>
            <p className="text-[16px] font-semibold text-fg">{target.toFixed(1)} is out of reach now, even with a 10 every semester.</p>
            <p className="mt-1 text-[14.5px] text-muted">
              The best you can finish with is <strong className="num marked text-fg">{fmt(f.maxAchievable, 2)}</strong>. Every point closer still shows on your final sheet.
            </p>
          </>
        )}
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {plan.horizons.map((h) => (
          <li key={h.sem} className="rounded-2xl border-[1.5px] border-line p-3.5">
            <p className="text-[13.5px] text-muted">{target.toFixed(1)} by the end of Sem {h.sem}?</p>
            <p className={cx('mt-1 flex items-center gap-1.5 text-[15.5px] font-semibold', h.reachable ? 'text-fg' : 'text-muted')}>
              {h.reachable ? <HandTick size={18} /> : <HandCross size={17} />}
              {h.required <= 0 ? 'Already there' : h.reachable ? `Yes, averaging ${fmt(h.required, 2)}` : `No. Best is ${fmt(h.maxAchievable, 2)}`}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3 border-t-[1.5px] border-dashed border-line pt-4">
        <label htmlFor={crId} className="text-[14px] text-muted">
          Counted credits in each remaining semester
        </label>
        <select id={crId} className="field !w-20 tabular" value={per} onChange={(e) => update((s) => ({ ...s, futureCredits: Number(e.target.value) }))}>
          {Array.from({ length: 15 }, (_, i) => i + 12).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </Card>
  );
}
