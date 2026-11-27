import { clamp, easeInOut, lerp } from "./math";
import type { Ken } from "./types";

/** Sticky-pin progress: 0 when the section pins, 1 when it releases. */
export function sectionProgress(
  rectTop: number,
  sectionHeight: number,
  viewport: number,
): number {
  const travel = sectionHeight - viewport;
  if (travel <= 0) return 0;
  return clamp(-rectTop / travel, 0, 1);
}

/** Crossfade weight for stacked stills. Neighbors share a 1-beat blend. */
export function crossfade(t: number, index: number, count: number): number {
  if (count <= 1) return 1;
  const x = t * (count - 1);
  return clamp(1 - Math.abs(x - index), 0, 1);
}

export function nearestBeat(t: number, count: number): number {
  if (count <= 1) return 0;
  return clamp(Math.round(t * (count - 1)), 0, count - 1);
}

export function kenTransform(
  local: number,
  ken: Ken,
  reduceMotion: boolean,
): { scale: number; x: number; y: number } {
  if (reduceMotion) return { scale: 1.06, x: 0, y: 0 };
  const u = easeInOut(clamp(local, 0, 1));
  const scale = lerp(1.18, 1.04, u);
  switch (ken) {
    case "left":
      return { scale, x: lerp(3.2, -2.4, u), y: lerp(0.6, -0.4, u) };
    case "right":
      return { scale, x: lerp(-3.2, 2.4, u), y: lerp(-0.4, 0.6, u) };
    case "out":
      return { scale: lerp(1.06, 1.2, u), x: 0, y: lerp(1.4, -1.2, u) };
    default:
      return { scale, x: lerp(-1.2, 1.1, u), y: lerp(1.6, -1.4, u) };
  }
}
