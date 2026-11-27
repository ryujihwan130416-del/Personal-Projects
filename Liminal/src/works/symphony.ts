import { grain, mix3, neonPath, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Node = { a: number; r: number; s: number; kind: number };

function create(): WorkRenderer {
  const rng = mulberry32(0x51e4);
  const nodes: Node[] = Array.from({ length: 240 }, () => ({
    a: rng() * TAU,
    r: 0.18 + rng() * 0.42,
    s: 0.5 + rng() * 1.6,
    kind: rng(),
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion } = frame;
      trail(ctx, 0.1, "6,3,16");
      const cx = w * 0.5;
      const cy = h * 0.5;
      const m1 = smoothstep(0, 0.28, t);
      const m2 = smoothstep(0.18, 0.55, t);
      const m3 = smoothstep(0.45, 0.8, t);
      const merge = smoothstep(0.78, 1, t);
      const mag: [number, number, number] = [255, 110, 200];
      const cyan: [number, number, number] = [120, 190, 255];
      const gold: [number, number, number] = [255, 220, 150];
      const col = mix3(mag, cyan, gold, t);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, cx, cy, Math.min(w, h) * 0.42, col, 0.1 + m3 * 0.08);

      const waves = quality === "preview" ? 3 : 5;
      for (let k = 0; k < waves; k++) {
        const amp = (26 + k * 10) * lerp(0.3, 1, m2) * (1 - merge * 0.35);
        const rgb = k % 3 === 0 ? mag : k % 3 === 1 ? cyan : gold;
        neonPath(
          ctx,
          () => {
            for (let x = 0; x <= w; x += 4) {
              const y =
                cy +
                Math.sin(x * (0.01 + k * 0.002) + time * (1.6 + k * 0.35) + k) *
                  amp +
                Math.sin(x * 0.023 - time * 1.2 + k) * amp * 0.28;
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
          },
          rgb,
          1.1,
          0.28 * m2 * (1 - k * 0.08),
        );
      }

      const rings = quality === "preview" ? 4 : 7;
      for (let i = 0; i < rings; i++) {
        const u = (i / rings + time * 0.06) % 1;
        const r = lerp(20, Math.min(w, h) * 0.4, u) * lerp(0.4, 1, m3);
        neonPath(
          ctx,
          () => {
            ctx.arc(cx, cy, r, 0, TAU);
          },
          i % 2 ? mag : cyan,
          1,
          (1 - u) * 0.22 * m3 * (1 - merge * 0.4),
        );
      }

      const count = quality === "preview" ? 70 : nodes.length;
      const spin = time * (reduceMotion ? 0.05 : 0.18);
      for (let i = 0; i < count; i++) {
        const n = nodes[i];
        const rad = n.r * Math.min(w, h) * lerp(0.35, 1, m1) * (1 - merge * 0.45);
        const pulse = 0.6 + 0.4 * Math.sin(time * 2.2 + n.a * 4);
        const x = cx + Math.cos(n.a + spin) * rad;
        const y = cy + Math.sin(n.a + spin) * rad * 0.78;
        const rgb = n.kind > 0.66 ? gold : n.kind > 0.33 ? cyan : mag;
        spark(ctx, x, y, n.s * 8 * pulse, rgb, 0.28 * m1 * pulse);
      }

      orb(ctx, cx, cy, lerp(12, 48, merge), gold, 0.22 * m3);
      ctx.restore();
      grain(ctx, w, h, 0.07);
      vignette(ctx, w, h, 0.48);
    },
  };
}

export const symphony: Work = {
  id: "symphony",
  index: "05",
  title: "Silent Symphony",
  titleKo: "들리지 않는 음악",
  tone: "#e08cff",
  durationVh: 800,
  previewT: (time) => 0.58 + Math.sin(time * 0.3) * 0.16,
  create,
};
