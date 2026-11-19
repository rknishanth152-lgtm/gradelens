import { useCountUp } from '../hooks/useCountUp';
import { fmt } from '../lib/grading';
import { cx } from './ui';

export function CountUp({ value, digits = 2, className, suffix, duration }: { value: number; digits?: number; className?: string; suffix?: string; duration?: number }) {
  const v = useCountUp(value, duration);
  return (
    <span className={cx('num', className)}>
      {fmt(v, digits)}
      {suffix}
    </span>
  );
}

/** A short margin note, the way a teacher would write it. */
export function remarkFor(sgpa: number): string {
  if (sgpa >= 9) return 'Top of the sheet.';
  if (sgpa >= 8) return "That's a great semester.";
  if (sgpa >= 7) return 'Solid work.';
  if (sgpa >= 6) return 'Steady. Room to climb.';
  if (sgpa >= 5) return "Through. Next sem's yours.";
  return 'Rough one. It is recoverable.';
}
