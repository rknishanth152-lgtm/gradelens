import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Animate a number from 0 to `target`. Respects prefers-reduced-motion. */
export function useCountUp(target: number, duration = 1100, delay = 0): number {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce || !Number.isFinite(target)) {
      setV(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, Math.max(0, (t - start - delay) / duration));
      const eased = 1 - Math.pow(1 - p, 4);
      setV(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, reduce]);
  return v;
}
