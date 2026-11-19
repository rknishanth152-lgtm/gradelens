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
    if (!s || typeof s !== 'object') return withHash(base);
    const merged: AppState = {
      ...base,
      ...s,
      sem3: { ...base.sem3, ...(s.sem3 ?? {}) },
      prev: {
        1: { ...base.prev[1], ...(s.prev?.[1] ?? {}) },
        2: { ...base.prev[2], ...(s.prev?.[2] ?? {}) },
      },
    };
    return withHash(sanitize(merged, base));
  } catch {
    return withHash(base);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/** Repair anything odd in saved data (older versions, hand edits) instead of crashing on it. */
function sanitize(s: AppState, base: AppState): AppState {
  const marks: AppState['sem3']['marks'] = {};
  if (isObj(s.sem3.marks)) {
    for (const [k, m] of Object.entries(s.sem3.marks)) {
      if (isObj(m)) marks[k] = { cia: str(m.cia), ese: str(m.ese), total: str(m.total) };
    }
  }
  const prev = (n: 1 | 2) => {
    const p = s.prev[n];
    const raw = isObj(p.sheet) && Array.isArray((p.sheet as { subjects?: unknown }).subjects) ? p.sheet : null;
    const subjects = raw ? raw.subjects.filter((x) => isObj(x) && typeof x.code === 'string') : [];
    const sheet = raw && subjects.length ? { ...raw, subjects, warnings: Array.isArray(raw.warnings) ? raw.warnings : [] } : null;
    return {
      ...p,
      method: p.method === 'manual' ? 'manual' : 'pdf',
      manualMode: p.manualMode === 'detailed' ? 'detailed' : 'quick',
      quickSgpa: str(p.quickSgpa),
      quickCredits: typeof p.quickCredits === 'number' && p.quickCredits > 0 ? p.quickCredits : base.prev[n].quickCredits,
      detailed: isObj(p.detailed) ? Object.fromEntries(Object.entries(p.detailed).map(([k, v]) => [k, str(v)])) : {},
      detailedCredits: isObj(p.detailedCredits) ? (p.detailedCredits as Record<string, number>) : {},
      sheet,
    } as PrevSemInput;
  };
  return {
    ...s,
    view: s.view === 'sgpa' || s.view === 'cgpa' ? s.view : 'landing',
    sem3Source: s.sem3Source === 'photo' || s.sem3Source === 'pdf' ? s.sem3Source : 'type',
    sem3Import: isObj(s.sem3Import) && isObj(s.sem3Import.filled) && Array.isArray(s.sem3Import.missing) ? s.sem3Import : null,
    cgpaStep: Number.isInteger(s.cgpaStep) ? Math.min(3, Math.max(0, s.cgpaStep)) : 0,
    plannerTarget: typeof s.plannerTarget === 'number' && s.plannerTarget >= 5 && s.plannerTarget <= 10 ? s.plannerTarget : 8,
    futureCredits: typeof s.futureCredits === 'number' && s.futureCredits > 0 ? s.futureCredits : base.futureCredits,
    cardName: str(s.cardName),
    cardReg: str(s.cardReg),
    sem3: {
      ...s.sem3,
      marks,
      credits: isObj(s.sem3.credits) ? (s.sem3.credits as Record<string, number>) : {},
      electiveCode: str(s.sem3.electiveCode) || base.sem3.electiveCode,
      mdcCode: str(s.sem3.mdcCode) || base.sem3.mdcCode,
      mdcOtherName: str(s.sem3.mdcOtherName),
      nptelName: str(s.sem3.nptelName),
      totalOnly: s.sem3.totalOnly !== false,
      nptelOn: s.sem3.nptelOn === true,
    },
    prev: { 1: prev(1), 2: prev(2) },
  };
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
