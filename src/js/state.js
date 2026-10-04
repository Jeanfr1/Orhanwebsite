export const media = {
  reduced: window.matchMedia('(prefers-reduced-motion: reduce)'),
  wide: window.matchMedia('(min-width: 900px) and (min-height: 560px)'),
  narrow: window.matchMedia('(max-width: 899px)'),
};

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const range = (v, a, b) => clamp01((v - a) / (b - a));
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// fade in over [a, b], hold, fade out over [c, d]
export const windowed = (v, a, b, c, d) => Math.min(range(v, a, b), 1 - range(v, c, d));
