import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { fmt } from '../lib/grading';

/** SGPA by semester, drawn in pen on graph paper. */
export function TrendChart({ values }: { values: number[] }) {
  const reduce = useReducedMotion();
  const pid = useId().replace(/:/g, '');
  const W = 320;
  const H = 190;
  const pad = { l: 30, r: 30, t: 30, b: 34 };
  const lo = Math.max(0, Math.floor(Math.min(...values) - 1));
  const hi = Math.min(10, Math.ceil(Math.max(...values) + 0.6));
  const x = (i: number) => pad.l + 18 + (i * (W - pad.l - pad.r - 36)) / Math.max(values.length - 1, 1);
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b);
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px},${py}`).join(' ');
  const delta = values.length > 1 ? values[values.length - 1] - values[values.length - 2] : 0;
  const d = Number(fmt(Math.abs(delta), 2));
  const deltaText = d === 0 ? 'Level with Sem 2' : delta > 0 ? `↑ improved by ${fmt(d, 2)}` : `↓ down by ${fmt(d, 2)}`;
  const gridY = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  const [lx, ly] = pts[pts.length - 1];

  return (
    <figure>
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-[21px] font-bold tracking-[-0.01em] text-fg">SGPA, semester by semester</figcaption>
      </div>
      <p className={`mt-1 text-[14.5px] font-semibold ${d === 0 ? 'text-muted' : delta > 0 ? 'text-pass' : 'text-fail'}`}>{deltaText} from Sem 2</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full rounded-xl" role="img" aria-label={`SGPA by semester: ${values.map((v, i) => `Sem ${i + 1} ${fmt(v, 2)}`).join(', ')}`}>
        <defs>
          <pattern id={`g-${pid}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="var(--rule)" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={W} height={H} fill={`url(#g-${pid})`} opacity="0.9" />
        {gridY.map((g) => (
          <g key={g}>
            <line x1={pad.l} x2={W - 8} y1={y(g)} y2={y(g)} stroke="var(--rule-strong)" strokeWidth="1" />
            <text x={pad.l - 7} y={y(g) + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-3)" fontFamily="var(--font-display)" fontWeight="600">
              {g}
            </text>
          </g>
        ))}
        <motion.path
          d={line}
          fill="none"
          stroke="var(--pen)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          initial={{ strokeDashoffset: reduce ? 0 : 1 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: reduce ? 0 : 0.8, ease: [0.77, 0, 0.175, 1] }}
        />
        <circle cx={lx} cy={ly} r="13" fill="var(--marker-soft)" />
        {pts.map(([px, py], i) => (
          <g key={i}>
            <circle cx={px} cy={py} r="5" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2.4" />
            <text x={px} y={py - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="var(--ink)" fontFamily="var(--font-display)">
              {fmt(values[i], 2)}
            </text>
            <text x={px} y={H - 10} textAnchor="middle" fontSize="11.5" fill="var(--ink-2)" fontFamily="var(--font-sans)" fontWeight="600">
              Sem {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
