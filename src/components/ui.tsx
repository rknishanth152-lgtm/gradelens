import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Info } from 'lucide-react';
import type { PassState } from '../lib/grading';
import { HandCross, HandTick } from './art';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'marker';

export function Button({ variant = 'primary', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'press inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[14px] px-5 text-[15.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-pen-strong text-on-pen shadow-[0_1px_0_rgba(255,255,255,0.18)_inset,0_10px_22px_-12px_var(--pen-strong)] hover:brightness-110',
        variant === 'secondary' && 'border-[1.5px] border-line-strong bg-surface text-fg hover:border-fg',
        variant === 'ghost' && 'text-muted hover:bg-surface hover:text-fg',
        variant === 'marker' && 'bg-marker text-on-marker hover:brightness-105',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, as: As = 'section' }: { className?: string; children: ReactNode; as?: 'section' | 'div' | 'article' }) {
  return <As className={cx('sheet rounded-[20px]', className)}>{children}</As>;
}

/** Segmented control (radio group). The active pill slides; nothing else moves. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode }>;
  label: string;
  size?: 'sm' | 'md';
}) {
  const id = useId();
  return (
    <div role="group" aria-label={label} className="relative flex rounded-[14px] border border-line bg-surface-2 p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx('relative flex-1 cursor-pointer rounded-[10px] px-2 font-semibold transition-colors duration-150', size === 'sm' ? 'min-h-11 text-[13.5px]' : 'min-h-11 text-[14.5px]', active ? 'text-fg' : 'text-muted hover:text-fg')}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[10px] border border-line-strong bg-surface shadow-sm" transition={{ type: 'spring', duration: 0.3, bounce: 0.12 }} />}
            <span className="relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0">
        <span className="block text-[15.5px] font-semibold text-fg">{label}</span>
        {description && <span className="mt-0.5 block text-[13.5px] leading-snug text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-[30px] w-[52px] rounded-full border-[1.5px] border-line-strong bg-surface-2 transition-colors duration-150 peer-checked:border-pen-strong peer-checked:bg-pen-strong peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-pen" />
        <span className="pointer-events-none absolute left-[5px] top-[5px] h-5 w-5 rounded-full bg-fg shadow transition-transform duration-200 ease-[var(--ease-out)] peer-checked:translate-x-[22px] peer-checked:bg-white" />
      </span>
    </label>
  );
}

export function InfoTip({ text, label = 'More info' }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-faint hover:text-fg"
      >
        <Info size={17} aria-hidden="true" />
      </button>
      {open && (
        <span role="tooltip" className="sheet absolute left-1/2 top-11 z-30 w-64 origin-top -translate-x-1/2 rounded-xl p-3 text-[13.5px] leading-snug text-muted">
          {text}
        </span>
      )}
    </span>
  );
}

/** Pass state written the way a teacher marks a sheet. */
export function PassChip({ state }: { state: PassState }) {
  if (state === 'empty') return null;
  const map = {
    pass: { text: 'Pass', cls: 'text-pass', icon: <HandTick size={17} /> },
    borderline: { text: 'Just made it', cls: 'text-warn', icon: <AlertTriangle size={15} aria-hidden="true" /> },
    fail: { text: 'Below pass', cls: 'text-fail', icon: <HandCross size={16} /> },
  } as const;
  const m = map[state];
  return (
    <span className={cx('inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold', m.cls)}>
      {m.icon}
      {m.text}
    </span>
  );
}

export function Notice({ tone = 'info', children, action }: { tone?: 'info' | 'warn' | 'ok' | 'error'; children: ReactNode; action?: ReactNode }) {
  const tones = {
    info: 'border-line bg-surface-2 text-fg',
    warn: 'border-warn/40 bg-[color-mix(in_srgb,var(--marker)_14%,var(--sheet))] text-fg',
    ok: 'border-pass/35 bg-[color-mix(in_srgb,var(--pass)_8%,var(--sheet))] text-fg',
    error: 'border-fail/40 bg-[color-mix(in_srgb,var(--fail)_7%,var(--sheet))] text-fg',
  };
  const icons = {
    info: <Info size={18} className="text-pen" aria-hidden="true" />,
    warn: <AlertTriangle size={18} className="text-warn" aria-hidden="true" />,
    ok: <HandTick size={19} />,
    error: <HandCross size={18} />,
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cx('flex flex-wrap items-start gap-3 rounded-2xl border-[1.5px] p-3.5 text-[14.5px] leading-snug', tones[tone])}>
      <span className="mt-0.5 shrink-0">{icons[tone]}</span>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}

/** Marks input: text + inputMode=decimal for a reliable number pad. */
export function MarkInput({
  id,
  value,
  onChange,
  max,
  label,
  error,
  placeholder,
  hideLabel,
  imported,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  label: string;
  error?: string;
  placeholder?: string;
  hideLabel?: boolean;
  imported?: 'high' | 'check';
}) {
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cx('mb-1.5 block text-[13.5px] font-medium text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="next"
          value={value}
          placeholder={placeholder ?? `0–${max}…`}
          onChange={(e) => onChange(e.target.value.replace(',', '.').replace(/\s/g, ''))}
          aria-invalid={error ? true : undefined}
          aria-describedby={cx(error && errId, imported === 'check' && hintId) || undefined}
          data-imported={imported}
          className="field tabular pr-16 text-[18px] font-semibold"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-faint tabular">/ {max}</span>
      </div>
      {imported === 'check' && !error && (
        <p id={hintId} className="mt-1 text-[12.5px] font-medium text-warn">
          Read from your file. Check this one.
        </p>
      )}
      {error && (
        <p id={errId} className="mt-1 text-[13px] font-medium text-fail">
          {error}
        </p>
      )}
    </div>
  );
}
