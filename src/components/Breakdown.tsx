import type { Sem3Row } from '../lib/sem3';
import { fmt } from '../lib/grading';
import { cx } from './ui';

function Tag({ row }: { row: Sem3Row }) {
  if (!row.counted) return <span className="hand shrink-0 whitespace-nowrap text-[15px] leading-none text-fail">not counted</span>;
  if (row.state === 'fail') return <span className="hand shrink-0 whitespace-nowrap text-[15px] leading-none text-fail">failed, 0 credits</span>;
  return null;
}

/** Paper-by-paper breakdown: a ruled table on wide screens, stacked slips on phones. */
export function Breakdown({ rows, totals }: { rows: Sem3Row[]; totals: { creditPoints: number; credits: number } }) {
  const effCredits = (r: Sem3Row) => (r.counted && r.state !== 'fail' ? r.credits : 0);
  return (
    <div>
      <ul className="divide-y-[1.5px] divide-dashed divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.def.id} className={cx('py-3.5', !r.counted && 'opacity-75')}>
            <div className="flex items-start justify-between gap-2">
              <p className={cx('min-w-0 text-[15px] font-semibold leading-snug', r.counted ? 'text-fg' : 'text-muted')}>{r.name}</p>
              <Tag row={r} />
            </div>
            <dl className="mt-2 grid grid-cols-4 gap-1 text-[12.5px] text-muted">
              {[
                ['Marks', `${r.total ?? '–'}/${r.def.totalMax}`],
                ['Grade pt', fmt(r.gradePoint, 1)],
                ['Credits', String(effCredits(r))],
                ['Points', r.counted ? fmt(r.creditPoints, 1) : '–'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd className="num mt-0.5 text-[16px] font-bold text-fg">{v}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
        <li className="flex justify-between pt-3.5 text-[15px] font-bold text-fg tabular">
          <span>Counted total</span>
          <span>
            {fmt(totals.creditPoints, 1)} points / {totals.credits} credits
          </span>
        </li>
      </ul>

      <div className="hidden overflow-hidden rounded-2xl border-[1.5px] border-line md:block">
        <table className="w-full text-left text-[14.5px]">
          <caption className="sr-only">Semester 3, paper by paper</caption>
          <thead className="bg-surface-2 text-[13px] text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Paper</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Marks</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Grade point</th>
              <th scope="col" className="px-3 py-3 text-right font-semibold">Credits</th>
              <th scope="col" className="px-4 py-3 text-right font-semibold">Credit points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.def.id}>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={cx('font-medium', r.counted ? 'text-fg' : 'text-muted')}>{r.name}</span>
                    <Tag row={r} />
                  </div>
                  <span className="text-[12.5px] text-faint" translate="no">
                    {r.code}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tabular text-fg">
                  {r.total ?? '–'}
                  <span className="text-faint">/{r.def.totalMax}</span>
                </td>
                <td className="px-3 py-3 text-right tabular text-fg">{fmt(r.gradePoint, 1)}</td>
                <td className="px-3 py-3 text-right tabular text-fg">{effCredits(r)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular text-fg">{r.counted ? fmt(r.creditPoints, 1) : '–'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-[1.5px] border-line-strong bg-surface-2 font-bold text-fg">
            <tr>
              <td className="px-4 py-3" colSpan={3}>
                Counted total
              </td>
              <td className="px-3 py-3 text-right tabular">{totals.credits}</td>
              <td className="px-4 py-3 text-right tabular">
                <span className="marked">{fmt(totals.creditPoints, 1)}</span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
