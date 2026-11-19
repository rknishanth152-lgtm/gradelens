/**
 * GradeLens illustration kit: hand-made SVG, drawn from exam-hall objects
 * (answer booklets, highlighters, a protractor, a rubber stamp, a teacher's pen).
 * Colours come from CSS tokens so every piece works in light and dark mode.
 */
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useCountUp } from '../hooks/useCountUp';

type SvgProps = { className?: string; size?: number };

// ---------------------------------------------------------------------------
// Brand
// ---------------------------------------------------------------------------

export function LogoMark({ size = 36 }: SvgProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="6" y="4" width="44" height="56" rx="9" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M14 19h28M14 29h20M14 39h14M14 49h22" stroke="var(--rule-strong)" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 29h20" stroke="var(--marker)" strokeWidth="7" strokeLinecap="round" opacity=".95" />
      <circle cx="40" cy="38" r="12" fill="var(--sheet)" fillOpacity=".55" stroke="var(--pen-strong)" strokeWidth="4.5" />
      <path d="M48.6 46.6 57 55" stroke="var(--pen-strong)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hand-drawn marks
// ---------------------------------------------------------------------------

/** A teacher's pen loop, drawn around whatever it wraps. */
export function PenCircle({ className, delay = 0.15, color = 'var(--pen)', width = 3, still = false }: { className?: string; delay?: number; color?: string; width?: number; still?: boolean }) {
  const reduce = useReducedMotion() || still;
  return (
    <svg className={className} viewBox="0 0 220 110" preserveAspectRatio="none" aria-hidden="true" style={{ overflow: 'visible' }}>
      <motion.path
        d="M34 64 C 20 34, 72 12, 118 13 C 166 14, 206 32, 200 60 C 194 88, 138 99, 96 97 C 50 95, 12 82, 16 57 C 19 38, 52 24, 82 20"
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
        strokeDasharray="1 1"
        initial={{ strokeDashoffset: reduce ? 0 : 1, opacity: reduce ? 0 : 1 }}
        animate={{ strokeDashoffset: 0, opacity: 1 }}
        transition={{ delay: reduce ? 0 : delay, duration: reduce ? 0.2 : 0.75, ease: [0.77, 0, 0.175, 1] }}
      />
    </svg>
  );
}

export function Squiggle({ className, color = 'var(--pen)' }: { className?: string; color?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
      <path d="M2 8 C 20 2, 30 12, 48 6 S 80 2, 98 8 S 130 12, 148 5 S 180 4, 198 8" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function HandTick({ size = 18, color = 'var(--pass)' }: SvgProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3.5 13.2c2.2 1.4 3.6 3 4.8 5.3C11 12 14.8 7.3 20.8 4.2" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HandCross({ size = 18, color = 'var(--fail)' }: SvgProps & { color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.5c4.6 4 9 8.8 13.6 13.2M18.8 5c-4.8 4-9.3 8.6-13.4 13.6" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Rubber stamp with uneven ink. */
export function Stamp({ top, bottom, centre, size = 112, color = 'var(--pass)', rotate = -12, className }: { top: string; bottom: string; centre: string; size?: number; color?: string; rotate?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <defs>
        <filter id={`ink-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
        <path id={`top-${id}`} d="M 18 60 A 42 42 0 0 1 102 60" />
        <path id={`bot-${id}`} d="M 14 60 A 46 46 0 0 0 106 60" />
      </defs>
      <g filter={`url(#ink-${id})`} fill={color} stroke={color}>
        <circle cx="60" cy="60" r="55" fill="none" strokeWidth="3.5" />
        <circle cx="60" cy="60" r="46" fill="none" strokeWidth="1.5" />
        <text fontFamily="var(--font-display)" fontWeight="700" fontSize="10.5" letterSpacing="1.6" stroke="none">
          <textPath href={`#top-${id}`} startOffset="50%" textAnchor="middle">
            {top}
          </textPath>
        </text>
        <text fontFamily="var(--font-display)" fontWeight="700" fontSize="9.5" letterSpacing="1.4" stroke="none">
          <textPath href={`#bot-${id}`} startOffset="50%" textAnchor="middle" dominantBaseline="hanging">
            {bottom}
          </textPath>
        </text>
        <text x="60" y="70" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="28" stroke="none">
          {centre}
        </text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Spot illustrations for the two journeys
// ---------------------------------------------------------------------------

/** One answer sheet, a highlighted line, a big circled 3. */
export function SpotThisSem({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 110" aria-hidden="true">
      <g transform="rotate(-5 70 55)">
        <rect x="26" y="10" width="78" height="94" rx="8" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2.2" />
        <path d="M40 10v94" stroke="var(--margin)" strokeWidth="1.6" />
        {[30, 42, 54, 66, 78, 90].map((y) => (
          <path key={y} d={`M46 ${y}h48`} stroke="var(--rule-strong)" strokeWidth="1.6" strokeLinecap="round" />
        ))}
        <path d="M46 54h40" stroke="var(--marker)" strokeWidth="8" strokeLinecap="round" opacity=".95" />
        <circle cx="33" cy="24" r="2.6" fill="var(--hole)" stroke="var(--rule-strong)" />
        <circle cx="33" cy="90" r="2.6" fill="var(--hole)" stroke="var(--rule-strong)" />
      </g>
      <g transform="translate(92 54)">
        <circle r="23" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2.2" />
        <path d="M-22 4 C -22 -16, 4 -26, 18 -14 C 28 -4, 22 18, 4 22 C -12 25, -24 12, -18 -4" fill="none" stroke="var(--pen)" strokeWidth="2.4" strokeLinecap="round" />
        <text x="0" y="10" textAnchor="middle" fontFamily="var(--font-hand)" fontWeight="700" fontSize="28" fill="var(--ink)">
          3
        </text>
      </g>
    </svg>
  );
}

/** Three sheets fanned out, with a trend line drawn across them. */
export function SpotAllSems({ className }: { className?: string }) {
  const sheets: Array<[number, number, string]> = [
    [-11, 28, 'I'],
    [0, 62, 'II'],
    [10, 96, 'III'],
  ];
  return (
    <svg className={className} viewBox="0 0 140 110" aria-hidden="true">
      {sheets.map(([r, x, label]) => (
        <g key={label} transform={`rotate(${r} ${x} 60)`}>
          <rect x={x - 22} y="22" width="44" height="60" rx="6" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2" />
          {[38, 48, 58, 68].map((y) => (
            <path key={y} d={`M${x - 13} ${y}h26`} stroke="var(--rule-strong)" strokeWidth="1.4" strokeLinecap="round" />
          ))}
          <text x={x} y="34" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="9" fill="var(--ink-2)">
            {label}
          </text>
        </g>
      ))}
      <path d="M14 84 C 34 80, 44 66, 62 64 S 92 50, 124 30" fill="none" stroke="var(--pen)" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M116 27 l9 2 -3 9" fill="none" stroke="var(--pen)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [26, 81],
        [62, 64],
        [100, 44],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="4.2" fill="var(--marker)" stroke="var(--ink)" strokeWidth="1.8" />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Line icons (24px grid, 1.8 stroke)
// ---------------------------------------------------------------------------

const icon = (size: number, children: React.ReactNode, className?: string) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
    {children}
  </svg>
);

export const IconOnDevice = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2.6" />
      <path d="M10.5 18.5h3" />
      <rect x="9" y="10.5" width="6" height="4.8" rx="1" />
      <path d="M10.3 10.5V9a1.7 1.7 0 0 1 3.4 0v1.5" />
    </>,
    className,
  );

export const IconStampMark = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <path d="M9.5 4.6a2.5 2.5 0 1 1 5 0c0 1.6-1.2 2.3-1.2 4.4h-2.6c0-2.1-1.2-2.8-1.2-4.4Z" />
      <path d="M5 12.5c0-1.9 1.4-3.5 3.3-3.5h7.4c1.9 0 3.3 1.6 3.3 3.5V15H5z" />
      <path d="M4 20h16" />
      <path d="M7 17.5h10" opacity=".55" />
    </>,
    className,
  );

export const IconStopwatch = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M10 2.5h4M12 2.5V6M18.4 7.2l1.3-1.3" />
      <path d="M12 13.5 15 10" />
    </>,
    className,
  );

export const IconType = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.6" />
      <path d="M6.5 9.5h.01M10.5 9.5h.01M14.5 9.5h.01M17.5 9.5h.01M6.5 13h.01M10.5 13h.01M14.5 13h.01M17.5 13h.01" strokeWidth="2.4" />
      <path d="M8 16.2h8" />
    </>,
    className,
  );

export const IconSnap = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" />
      <path d="M8 9h8M8 12h6M8 15h7" />
    </>,
    className,
  );

export const IconPdfSheet = ({ size = 24, className }: SvgProps) =>
  icon(
    size,
    <>
      <path d="M14 2.5H7A2.5 2.5 0 0 0 4.5 5v14A2.5 2.5 0 0 0 7 21.5h10a2.5 2.5 0 0 0 2.5-2.5V8Z" />
      <path d="M14 2.5V8h5.5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </>,
    className,
  );

// ---------------------------------------------------------------------------
// Protractor gauge (geometry-box protractor, 0–10)
// ---------------------------------------------------------------------------

export function Protractor({ value, label, children }: { value: number; label: string; children?: React.ReactNode }) {
  const W = 300;
  const cx = 150;
  const cy = 156;
  const R = 136;
  const v = Math.max(0, Math.min(10, value));
  // Needle and arc follow the same eased count-up as the big number (one timing family).
  const shown = useCountUp(v, 900);
  const pt = (val: number, r: number) => {
    const a = Math.PI - (val / 10) * Math.PI;
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  const band = R - 8;
  const [hx, hy] = pt(Math.max(shown, 0.001), band);
  const ticks = Array.from({ length: 101 }, (_, i) => i / 10);
  return (
    <div role="img" aria-label={`${label}: ${v.toFixed(2)} out of 10`} className="relative w-full max-w-[340px]">
      <svg viewBox={`0 0 ${W} 178`} className="w-full" aria-hidden="true">
        {/* Plastic body */}
        <path d={`M${cx - R - 8} ${cy} A ${R + 8} ${R + 8} 0 0 1 ${cx + R + 8} ${cy} Z`} fill="color-mix(in srgb, var(--pen) 6%, var(--sheet))" stroke="var(--rule-strong)" strokeWidth="1.5" />
        <path d={`M${cx - 44} ${cy} A 44 44 0 0 1 ${cx + 44} ${cy}`} fill="none" stroke="var(--rule)" strokeWidth="1.5" />
        {/* Highlighter swipe from 0 to the value */}
        <path d={`M${cx - band} ${cy} A ${band} ${band} 0 0 1 ${hx} ${hy}`} fill="none" stroke="var(--marker)" strokeOpacity="0.85" strokeWidth="16" strokeLinecap="butt" />
        {/* Graduations */}
        {ticks.map((t) => {
          const major = Math.abs(t - Math.round(t)) < 1e-6;
          const half = !major && Math.abs(t * 2 - Math.round(t * 2)) < 1e-6;
          const [x1, y1] = pt(t, R);
          const [x2, y2] = pt(t, R - (major ? 16 : half ? 10 : 5));
          return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink)" strokeOpacity={major ? 0.85 : 0.4} strokeWidth={major ? 1.6 : 1} />;
        })}
        {Array.from({ length: 11 }, (_, i) => {
          const [x, y] = pt(i, R - 30);
          return (
            <text key={i} x={x} y={y + 4} textAnchor="middle" fontSize="11" fontFamily="var(--font-display)" fontWeight="600" fill="var(--ink-2)">
              {i}
            </text>
          );
        })}
        <line x1={cx - R - 8} y1={cy} x2={cx + R + 8} y2={cy} stroke="var(--rule-strong)" strokeWidth="1.5" />
        {/* Needle */}
        <g transform={`rotate(${(shown / 10) * 180} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx - R + 6} y2={cy} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
          <circle cx={cx - R + 6} cy={cy} r="3.5" fill="var(--pen-strong)" />
        </g>
        <circle cx={cx} cy={cy} r="9" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="2.2" />
        <circle cx={cx} cy={cy} r="2.6" fill="var(--ink)" />
      </svg>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload / reading illustrations
// ---------------------------------------------------------------------------

export function ScanningSheet({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="relative mx-auto h-36 w-28 overflow-hidden rounded-xl border-2 border-fg bg-surface">
        <div className="ruled absolute inset-0 opacity-80" />
        <div className="absolute left-3 right-3 top-[52px] h-2.5 rounded-full bg-marker" style={{ clipPath: `inset(0 ${100 - Math.round(progress * 100)}% 0 0)`, transition: 'clip-path 300ms var(--ease-out)' }} />
        <div className="scanline absolute inset-x-0 top-0 h-full">
          <div className="h-0.5 w-full bg-pen shadow-[0_0_12px_2px_var(--pen)]" />
        </div>
      </div>
    </div>
  );
}
