export const TAU = Math.PI * 2;

export function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, v: number): number {
  if (a === b) return 0;
  return clamp((v - a) / (b - a), 0, 1);
}

export function remap(
  v: number,
  a: number,
  b: number,
  c: number,
  d: number,
): number {
  return lerp(c, d, inverseLerp(a, b, v));
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = inverseLerp(a, b, x);
  return t * t * (3 - 2 * t);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Triangle weight that peaks at `peak` and is zero outside [start, end]. */
export function ridge(
  t: number,
  start: number,
  peak: number,
  end: number,
): number {
  if (t <= start || t >= end) return 0;
  if (t < peak) return inverseLerp(start, peak, t);
  return inverseLerp(end, peak, t);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(i: number, j: number): number {
  const n = Math.imul(i | 0, 374761393) + Math.imul(j | 0, 668265263);
  const x = (n ^ (n >>> 13)) >>> 0;
  return (Math.imul(x, 1274126177) >>> 0) / 4294967296;
}

export function mixColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function rgba(
  rgb: [number, number, number],
  a: number,
): string {
  return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
}
