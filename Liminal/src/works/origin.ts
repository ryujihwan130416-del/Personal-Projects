import { fbm, flowAngle, grain, mix3, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, smoothstep } from "../math";
import type { Work, WorkRenderer } from "../types";

type P = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  s: number;
  seed: number;
  kind: number;
};

function create(): WorkRenderer {
  const rng = mulberry32(0x0e1914);
  const ps: P[] = Array.from({ length: 1600 }, () => ({
    x: rng(),
    y: rng(),
    vx: 0,
    vy: 0,
    s: 0.35 + rng() * 1.7,
    seed: rng() * 100,
    kind: rng(),
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion, pointer, pointerX, pointerY } =
        frame;
      const n = quality === "preview" || reduceMotion ? 320 : ps.length;
      const fade = lerp(0.16, 0.08, t);
      trail(ctx, fade, "2,1,4");

      const cx = 0.5 + (pointer ? (pointerX / w - 0.5) * 0.06 : 0);
      const cy = 0.5 + (pointer ? (pointerY / h - 0.5) * 0.06 : 0);
      const gather = smoothstep(0.08, 0.62, t);
      const bloom = smoothstep(0.55, 0.92, t);
      const hush = smoothstep(0.88, 1, t);
      const gold: [number, number, number] = [255, 214, 168];
      const ice: [number, number, number] = [186, 214, 255];
      const white: [number, number, number] = [255, 248, 240];
      const col = mix3(gold, white, ice, t);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, cx * w, cy * h, Math.min(w, h) * lerp(0.14, 0.26, bloom), col, 0.08 + bloom * 0.08);
      orb(
        ctx,
        cx * w,
        cy * h,
        Math.min(w, h) * lerp(0.03, 0.08, bloom),
        white,
        0.12 * bloom * (1 - hush * 0.35),
      );

      const motion = reduceMotion ? 0.25 : 1;
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        const px = p.x * w;
        const py = p.y * h;
        const ang = flowAngle(px, py, time * motion + p.seed);
        p.vx += Math.cos(ang) * 0.00055 * motion;
        p.vy += Math.sin(ang) * 0.00055 * motion;

        const dx = p.x - cx;
        const dy = p.y - cy;
        const dist = Math.hypot(dx, dy) + 0.0008;
        const swirl = Math.atan2(dy, dx) + 0.55;
        p.vx += (Math.cos(swirl) * 0.0003 - dx * 0.0011) * gather * motion;
        p.vy += (Math.sin(swirl) * 0.0003 - dy * 0.0011) * gather * motion;
        p.vx += (dx / dist) * bloom * 0.0011 * motion;
        p.vy += (dy / dist) * bloom * 0.0011 * motion;

        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -0.05) p.x += 1.1;
        if (p.x > 1.05) p.x -= 1.1;
        if (p.y < -0.05) p.y += 1.1;
        if (p.y > 1.05) p.y -= 1.1;

        const rgb = p.kind > 0.72 ? ice : p.kind > 0.4 ? white : gold;
        const pulse = 0.65 + 0.35 * Math.sin(time * 0.9 + p.seed);
        const size = p.s * lerp(7, 16, t) * pulse;
        const a = (0.18 + t * 0.45) * pulse * (1 - hush * 0.15);
        spark(ctx, p.x * w, p.y * h, size, rgb, a);
      }

      ctx.restore();
      grain(ctx, w, h, 0.07);
      vignette(ctx, w, h, 0.42 + fbm(time * 0.2, t) * 0.04);
    },
  };
}

export const origin: Work = {
  id: "origin",
  index: "01",
  title: "Origin of Light",
  titleKo: "빛은 천천히 태어난다",
  tone: "#f0d7b0",
  durationVh: 820,
  previewT: (time) => 0.58 + Math.sin(time * 0.22) * 0.16,
  create,
};
