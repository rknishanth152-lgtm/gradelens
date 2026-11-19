let fired = new Set<string>();

/**
 * Paper-scrap confetti for an 8+ result: once per result, timed to land as the pen circle closes.
 * Skipped entirely for reduced motion.
 */
export async function celebrate(key: string, delayMs = 800) {
  if (fired.has(key)) return;
  fired.add(key);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const { default: confetti } = await import('canvas-confetti');
  await new Promise((r) => setTimeout(r, delayMs));
  const colors = ['#FFE14A', '#2347D9', '#121C3A', '#C3283A', '#FFFFFF'];
  const base = { particleCount: 60, spread: 64, startVelocity: 38, ticks: 170, gravity: 1.1, scalar: 1, shapes: ['square' as const], colors, disableForReducedMotion: true };
  confetti({ ...base, origin: { x: 0.2, y: 0.4 }, angle: 62 });
  confetti({ ...base, origin: { x: 0.8, y: 0.4 }, angle: 118 });
}

export function resetCelebrations() {
  fired = new Set();
}
