import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_FUTURE_CREDITS } from '../data/subjects';
import { defaultSem3Input, type Sem3Input } from '../lib/sem3';
import { defaultPrevInput, type PrevSemInput } from '../lib/prevSem';

export type View = 'landing' | 'sgpa' | 'cgpa';
export type Sem3Source = 'type' | 'photo' | 'pdf';

export interface Sem3ImportMeta {
  kind: 'photo' | 'pdf';
  fileName: string;
  /** Subject id → how sure we are. Cleared per field when the student edits it. */
  filled: Record<string, 'high' | 'check'>;
  missing: string[];
}

export interface AppState {
  sem3Source: Sem3Source;
  sem3Import: Sem3ImportMeta | null;
  view: View;
  sgpaShowResult: boolean;
  /** 0 = Sem 1, 1 = Sem 2, 2 = Sem 3, 3 = Result */
  cgpaStep: number;
  sem3: Sem3Input;
  prev: { 1: PrevSemInput; 2: PrevSemInput };
  plannerTarget: number;
  futureCredits: number;
  cardName: string;
  cardReg: string;
}

const KEY = 'gradelens:v1';

export function initialState(): AppState {
  return {
    sem3Source: 'type',
    sem3Import: null,
    view: 'landing',
    sgpaShowResult: false,
    cgpaStep: 0,
    sem3: defaultSem3Input(),
    prev: { 1: defaultPrevInput(1), 2: defaultPrevInput(2) },
    plannerTarget: 8,
    futureCredits: DEFAULT_FUTURE_CREDITS,
    cardName: '',
    cardReg: '',
  };
}

function load(): AppState {
  const base = initialState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return withHash(base);
    const s = JSON.parse(raw) as Partial<AppState>;
    return withHash({
      ...base,
      ...s,
      sem3: { ...base.sem3, ...(s.sem3 ?? {}) },
      prev: {
        1: { ...base.prev[1], ...(s.prev?.[1] ?? {}) },
        2: { ...base.prev[2], ...(s.prev?.[2] ?? {}) },
      },
    });
  } catch {
    return withHash(base);
  }
}

function hashView(): View | null {
  const h = typeof location !== 'undefined' ? location.hash.replace('#', '') : '';
  return h === 'sgpa' || h === 'cgpa' ? h : h === '' ? 'landing' : null;
}

function withHash(s: AppState): AppState {
  const v = hashView();
  return v ? { ...s, view: v } : s;
}

type Updater = (draft: AppState) => AppState;

interface Store {
  state: AppState;
  update: (fn: Updater) => void;
  go: (view: View) => void;
  clearAll: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(load);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        /* storage full or blocked: ignore */
      }
    }, 250);
  }, [state]);

  useEffect(() => {
    const onPop = () => {
      const v = hashView() ?? 'landing';
      setState((s) => ({ ...s, view: v }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update = useCallback((fn: Updater) => setState((s) => fn(s)), []);

  const go = useCallback((view: View) => {
    const target = view === 'landing' ? '' : `#${view}`;
    if (location.hash !== target) {
      history.pushState(null, '', target || location.pathname + location.search);
    }
    setState((s) => ({ ...s, view }));
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const clearAll = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    history.pushState(null, '', location.pathname + location.search);
    setState(initialState());
    window.scrollTo({ top: 0 });
  }, []);

  const value = useMemo(() => ({ state, update, go, clearAll }), [state, update, go, clearAll]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/** True when the user has typed anything worth keeping. */
export function hasData(s: AppState): boolean {
  return (
    Object.values(s.sem3.marks).some((m) => m.total || m.cia || m.ese) ||
    [s.prev[1], s.prev[2]].some((p) => p.quickSgpa || p.sheet || Object.values(p.detailed).some(Boolean))
  );
}
