import { useEffect, useRef, useState } from 'react';
import { Moon, Sun, Eraser } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { hasData, useStore } from '../state/store';
import { resetCelebrations } from '../lib/celebrate';
import { LogoMark } from './art';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="press inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[14px] border-[1.5px] border-line bg-surface text-muted hover:border-line-strong hover:text-fg"
    >
      {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
    </button>
  );
}

function ClearAll() {
  const { state, clearAll } = useStore();
  const [confirm, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!confirm) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setConfirm(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setConfirm(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [confirm]);
  if (!hasData(state) && !confirm) return null;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setConfirm((c) => !c)}
        aria-expanded={confirm}
        aria-label="Start fresh: erase everything you've entered"
        className="press inline-flex h-11 cursor-pointer items-center gap-2 rounded-[14px] border-[1.5px] border-line bg-surface px-3 text-[14px] font-semibold text-muted hover:border-line-strong hover:text-fg"
      >
        <Eraser size={18} aria-hidden="true" />
        <span className="hidden sm:inline">Start fresh</span>
      </button>
      {confirm && (
        <div role="dialog" aria-label="Confirm erasing" className="sheet absolute right-0 top-[52px] z-40 w-[min(18rem,calc(100vw-2rem))] origin-top-right rounded-2xl p-4">
          <p className="text-[15px] font-semibold text-fg">Erase every mark on this phone?</p>
          <p className="mt-1 text-[13.5px] leading-snug text-muted">Sem 1, 2 and 3, uploads included. This can't be undone.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" autoFocus onClick={() => setConfirm(false)} className="press min-h-11 flex-1 cursor-pointer rounded-xl border-[1.5px] border-line-strong text-[14px] font-semibold text-fg">
              Keep them
            </button>
            <button
              type="button"
              onClick={() => {
                resetCelebrations();
                clearAll();
                setConfirm(false);
              }}
              className="press min-h-11 flex-1 cursor-pointer rounded-xl bg-fail text-[14px] font-semibold text-white dark:text-[#2a0a0e]"
            >
              Erase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { go, state } = useStore();
  return (
    <header className="safe-top relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 sm:pt-6">
      <button
        type="button"
        onClick={() => go('landing')}
        className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-2xl text-left"
        aria-current={state.view === 'landing' ? 'page' : undefined}
      >
        <LogoMark size={38} />
        <span className="min-w-0">
          <span className="block font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] text-fg" translate="no">
            GradeLens
          </span>
          <span className="mt-1 block text-[12.5px] leading-tight text-muted">SKASC B.Sc CT, 2025–28</span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <ClearAll />
        <ThemeToggle />
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-10 pt-14 text-[13.5px] leading-relaxed text-muted sm:px-6">
      <div className="border-t-[1.5px] border-dashed border-line-strong pt-6 sm:flex sm:items-start sm:justify-between sm:gap-8">
        <p className="max-w-xl">
          Unofficial. Sem 3 credits are our best estimate, so check the college's statement before you quote a number anywhere.
        </p>
        <p className="hand mt-3 shrink-0 text-[16px] text-fg sm:mt-0">Made by a classmate, for the class of '28</p>
      </div>
    </footer>
  );
}
