import { grain, mix3, neonPath, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, smoothstep } from "../math";
import type { Work, WorkRenderer } from "../types";

type Building = { x: number; w: number; h: number };
type Light = { bx: number; u: number; v: number; warm: number; s: number };

function create(): WorkRenderer {
  const rng = mulberry32(0xc17e);
  const buildings: Building[] = [];
  let x = 0.03;
  while (x < 0.97) {
    const bw = 0.035 + rng() * 0.055;
    buildings.push({ x, w: bw, h: 0.16 + rng() * 0.46 });
    x += bw + 0.006 + rng() * 0.01;
  }
  const lights: Light[] = [];
  for (let bi = 0; bi < buildings.length; bi++) {
    const cols = 2 + ((rng() * 3) | 0);
    const rows = 5 + ((rng() * 8) | 0);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() > 0.18) {
          lights.push({
            bx: bi,
            u: (c + 0.35 + rng() * 0.3) / cols,
            v: (r + 0.25 + rng() * 0.2) / rows,
            warm: rng(),
            s: 0.6 + rng() * 1.2,
          });
        }
      }
    }
  }
  const stars = Array.from({ length: 90 }, () => ({
    x: rng(),
    y: rng() * 0.48,
    s: rng(),
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion } = frame;
      trail(ctx, 0.12, "3,5,12");
      const skyline = smoothstep(0.02, 0.2, t);
      const glowIn = smoothstep(0.02, 0.28, t);
      const lift = smoothstep(0.55, 0.88, t);
      const net = smoothstep(0.72, 1, t);
      const horizon = h * 0.76;
      const gold: [number, number, number] = [255, 210, 140];
      const ice: [number, number, number] = [160, 210, 255];
      const teal: [number, number, number] = [80, 200, 230];

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, w * 0.5, h * 0.2, h * 0.55, [40, 60, 120], 0.1);
      orb(ctx, w * 0.7, horizon - 40, w * 0.4, gold, 0.06 * glowIn);

      for (const s of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(time * (0.5 + s.s) + s.x * 9));
        spark(ctx, s.x * w, s.y * h, 3 + s.s * 3, ice, 0.2 * tw);
      }

      ctx.restore();
      ctx.save();
      ctx.globalAlpha = skyline * (1 - lift * 0.85);
      for (const b of buildings) {
        const bx = b.x * w;
        const bw = b.w * w;
        const bh = b.h * h * skyline;
        ctx.fillStyle = "rgba(8, 14, 32, 0.9)";
        ctx.fillRect(bx, horizon - bh, bw, bh);
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const use =
        quality === "preview" || reduceMotion
          ? lights.filter((_, i) => i % 3 === 0)
          : lights;
      const pts: { x: number; y: number }[] = [];
      for (const light of use) {
        const b = buildings[light.bx];
        if (!b) continue;
        const bx = b.x * w;
        const bw = b.w * w;
        const bh = b.h * h * Math.max(skyline, 0.2);
        const lx = bx + light.u * bw;
        let ly = horizon - bh + light.v * bh;
        ly -= lift * (80 + light.warm * 120);
        const on = 0.45 + 0.55 * Math.abs(Math.sin(time * 0.55 + lx * 0.04));
        const rgb = light.warm > 0.78 ? teal : light.warm > 0.35 ? gold : ice;
        const lit = glowIn * on;
        ctx.fillStyle = `rgba(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0},${0.55 * lit})`;
        ctx.fillRect(lx - 1.6, ly - 2.4, 3.2, 4.8);
        spark(ctx, lx, ly, light.s * lerp(10, 18, glowIn), rgb, 0.55 * lit);
        pts.push({ x: lx, y: ly });
        if (lift < 0.85) {
          spark(
            ctx,
            lx,
            horizon + (horizon - ly) * 0.28,
            light.s * 7,
            rgb,
            0.18 * lit * (1 - lift),
          );
        }
      }

      if (net > 0.05) {
        const cap = quality === "preview" ? 40 : 80;
        const max = lerp(36, 110, net);
        ctx.lineWidth = 0.7;
        for (let i = 0; i < Math.min(pts.length, cap); i++) {
          const a = pts[i];
          let linked = 0;
          for (let j = i + 1; j < pts.length && linked < 2; j++) {
            const b = pts[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > max) continue;
            ctx.strokeStyle = `rgba(140,220,255,${(1 - d / max) * 0.16 * net})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            linked++;
          }
        }
      }

      neonPath(
        ctx,
        () => {
          ctx.moveTo(0, horizon);
          ctx.lineTo(w, horizon);
        },
        mix3(gold, ice, teal, t),
        1,
        0.12 * skyline * (1 - lift * 0.5),
      );

      ctx.restore();
      grain(ctx, w, h, 0.08);
      vignette(ctx, w, h, 0.5);
    },
  };
}

export const city: Work = {
  id: "city",
  index: "06",
  title: "City as Signal",
  titleKo: "도시는 신호가 된다",
  tone: "#8ad7ff",
  durationVh: 820,
  previewT: (time) => 0.4 + Math.sin(time * 0.16) * 0.22,
  create,
};
