import { grain, mix3, neonPath, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, ridge, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Drop = { x: number; y: number; v: number; len: number; s: number };

function create(): WorkRenderer {
  const rng = mulberry32(0x11ea7e);
  const drops: Drop[] = Array.from({ length: 420 }, () => ({
    x: rng(),
    y: rng(),
    v: 0.22 + rng() * 0.7,
    len: 10 + rng() * 28,
    s: 0.5 + rng(),
  }));
  const motes = Array.from({ length: 180 }, () => ({
    x: rng(),
    y: rng(),
    s: 0.6 + rng() * 1.8,
    p: rng() * TAU,
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion } = frame;
      const still = ridge(t, -0.04, 0.1, 0.3);
      const storm = ridge(t, 0.28, 0.5, 0.72);
      const rain = ridge(t, 0.52, 0.72, 0.9);
      const after = ridge(t, 0.74, 0.92, 1.08);
      const mist: [number, number, number] = [70, 86, 110];
      const violet: [number, number, number] = [168, 92, 220];
      const cyan: [number, number, number] = [110, 190, 255];
      const gold: [number, number, number] = [255, 210, 160];
      const col = mix3(mist, violet, t < 0.62 ? cyan : gold, t);

      trail(ctx, 0.11, `${8 + storm * 18 | 0},${6 + after * 8 | 0},${14 + rain * 20 | 0}`);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, w * 0.5, h * 0.28, h * 0.55, col, 0.1 + storm * 0.08);
      orb(ctx, w * 0.72, h * 0.62, h * 0.4, mix3(violet, cyan, gold, t), 0.07);
      orb(ctx, w * 0.22, h * 0.7, h * 0.32, cyan, 0.05 * rain + 0.04);

      const ribbons = quality === "preview" ? 5 : 8;
      const amp = lerp(18, 70, t) * (1 + storm * 0.55);
      for (let i = 0; i < ribbons; i++) {
        const y0 = h * (0.22 + i * 0.07);
        const speed = 0.35 + i * 0.07;
        const rgb = i % 3 === 0 ? violet : i % 3 === 1 ? cyan : gold;
        const a = (0.22 + still * 0.1 + storm * 0.2) * (1 - i * 0.06);
        neonPath(
          ctx,
          () => {
            for (let x = 0; x <= w; x += 6) {
              const y =
                y0 +
                Math.sin(x * 0.0065 + time * speed + i) * amp +
                Math.sin(x * 0.018 - time * (0.8 + i * 0.1) + i * 1.7) * amp * 0.35;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          },
          rgb,
          1.1 + (i % 2) * 0.6,
          a,
        );
      }

      if (rain > 0.02) {
        const speed = reduceMotion ? 0.12 : 0.7;
        const count = quality === "preview" ? 90 : drops.length;
        for (let i = 0; i < count; i++) {
          const d = drops[i];
          const y = ((d.y + time * d.v * speed) % 1) * (h + 50) - 20;
          const x = d.x * w + Math.sin(time * 0.4 + d.x * 9) * 12;
          ctx.strokeStyle = `rgba(170,210,255,${0.22 * rain})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 3, y + d.len * rain);
          ctx.stroke();
          spark(ctx, x, y, 6 * d.s, cyan, 0.35 * rain);
        }
      }

      for (const m of motes) {
        const x = (m.x + Math.sin(time * 0.07 + m.p) * 0.04) * w;
        const y = (m.y + Math.cos(time * 0.05 + m.p) * 0.03) * h;
        spark(ctx, x, y, 5 + m.s * 4, col, 0.12 + after * 0.2 + still * 0.1);
      }

      if (after > 0) {
        for (let i = 0; i < 5; i++) {
          const r = (50 + i * 70 + Math.sin(time * 0.35 + i) * 10) * after;
          neonPath(
            ctx,
            () => {
              ctx.arc(w * 0.5, h * 0.48, r, 0, TAU);
            },
            gold,
            1.2,
            0.16 * after * (1 - i * 0.12),
          );
        }
        orb(ctx, w * 0.5, h * 0.48, 90, gold, 0.2 * after);
      }

      const flash = storm * Math.max(0, Math.sin(time * 6.5) - 0.82) * 4;
      if (flash > 0) orb(ctx, w * 0.5, h * 0.2, h * 0.8, [255, 180, 220], 0.08 * flash);

      ctx.restore();
      grain(ctx, w, h, 0.08 + storm * 0.05);
      vignette(ctx, w, h, 0.4);
    },
  };
}

export const weather: Work = {
  id: "weather",
  index: "02",
  title: "Weather Inside Me",
  titleKo: "내 안의 날씨",
  tone: "#b7a0ff",
  durationVh: 860,
  previewT: (time) => 0.48 + Math.sin(time * 0.18) * 0.32,
  create,
};
