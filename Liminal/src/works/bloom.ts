import { grain, neonPath, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type P = { a: number; u: number; s: number; kind: number };

function create(): WorkRenderer {
  const rng = mulberry32(0xb100d);
  const petals = 8;
  const ps: P[] = Array.from({ length: 1400 }, () => ({
    a: rng() * TAU,
    u: rng(),
    s: 0.4 + rng() * 1.6,
    kind: rng(),
  }));
  const pollen = Array.from({ length: 220 }, () => ({
    a: rng() * TAU,
    r: rng(),
    s: 0.5 + rng() * 1.4,
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion } = frame;
      const n = quality === "preview" || reduceMotion ? 280 : ps.length;
      trail(ctx, 0.12, "4,8,6");

      const open = smoothstep(0.18, 0.7, t);
      const bloom = smoothstep(0.42, 0.78, t);
      const scatter = smoothstep(0.78, 1, t);
      const hx = w * 0.5;
      const hy = h * 0.46;
      const rose: [number, number, number] = [255, 168, 196];
      const cream: [number, number, number] = [255, 228, 210];
      const leaf: [number, number, number] = [160, 220, 150];
      const gold: [number, number, number] = [255, 220, 150];

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, hx, h * 0.82, w * 0.55, [40, 70, 40], 0.12);
      orb(ctx, hx, hy, Math.min(w, h) * lerp(0.08, 0.34, bloom), rose, 0.1 * bloom);

      const ground = h * 0.84;
      neonPath(
        ctx,
        () => {
          ctx.moveTo(w * 0.12, ground);
          for (let x = w * 0.12; x <= w * 0.88; x += 10) {
            ctx.lineTo(x, ground + Math.sin(x * 0.03 + time * 0.2) * 3);
          }
        },
        leaf,
        1.2,
        0.18,
      );

      neonPath(
        ctx,
        () => {
          const top = lerp(ground, hy + 40, smoothstep(0.08, 0.45, t));
          ctx.moveTo(hx, ground);
          ctx.quadraticCurveTo(
            hx + Math.sin(time * 0.3) * 18,
            (ground + top) * 0.5,
            hx,
            top,
          );
        },
        leaf,
        1.6,
        0.35 * open,
      );

      const spin = time * (reduceMotion ? 0.04 : 0.08);
      const span = Math.min(w, h);
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        const a = p.a + spin * (0.35 + p.u * 0.3);
        const roseR = Math.pow(Math.abs(Math.cos(petals * a)), 1.08);
        const maxR = lerp(0.03, 0.36, open) * (0.12 + roseR * 0.92);
        const reach = Math.pow(p.u, 0.62) * maxR + p.u * scatter * 0.38;
        const wobble = Math.sin(time * 0.55 + p.a * 2.4) * 0.006;
        const x = hx + Math.cos(a) * (reach + wobble) * span;
        const y =
          hy +
          Math.sin(a) * (reach + wobble) * span * 0.92 -
          scatter * p.u * 36;
        const rgb: [number, number, number] =
          p.kind > 0.82 ? cream : p.kind > 0.22 ? rose : [255, 132, 168];
        const size = p.s * lerp(7, 14, bloom);
        spark(ctx, x, y, size, rgb, (0.22 + bloom * 0.4) * (1 - scatter * 0.15));
      }

      if (scatter > 0.02) {
        for (const d of pollen) {
          const dist = 20 + d.r * 220 * scatter;
          spark(
            ctx,
            hx + Math.cos(d.a + time * 0.12) * dist,
            hy + Math.sin(d.a + time * 0.1) * dist * 0.7 - scatter * 50,
            5 + d.s * 4,
            d.r > 0.5 ? rose : gold,
            0.4 * scatter,
          );
        }
      }

      orb(ctx, hx, hy, 18 + bloom * 16, gold, 0.35 * bloom * (1 - scatter * 0.5));
      ctx.restore();
      grain(ctx, w, h, 0.07);
      vignette(ctx, w, h, 0.45);
    },
  };
}

export const bloom: Work = {
  id: "bloom",
  index: "03",
  title: "Digital Bloom",
  titleKo: "스크롤로 피어나는 정원",
  tone: "#f0b8c8",
  durationVh: 820,
  previewT: (time) => 0.62 + Math.sin(time * 0.25) * 0.12,
  create,
};
