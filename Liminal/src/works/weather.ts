import { glow, grain, lightning, trail, vignette } from "../draw";
import { lerp, mulberry32, rgba, ridge, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Drop = { x: number; y: number; v: number; len: number };
type Spark = { x: number; y: number; vx: number; vy: number };

function create(): WorkRenderer {
  const rng = mulberry32(0x11ea7e);
  const dots = Array.from({ length: 90 }, () => ({
    x: rng(),
    y: rng(),
    s: 0.6 + rng() * 1.8,
    p: rng() * TAU,
  }));
  const drops: Drop[] = Array.from({ length: 220 }, () => ({
    x: rng(),
    y: rng(),
    v: 0.18 + rng() * 0.55,
    len: 8 + rng() * 22,
  }));
  const sparks: Spark[] = Array.from({ length: 40 }, () => ({
    x: rng(),
    y: rng(),
    vx: (rng() - 0.5) * 0.35,
    vy: (rng() - 0.5) * 0.35,
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, reduceMotion } = frame;
      const still = ridge(t, -0.05, 0.08, 0.28);
      const noise = ridge(t, 0.14, 0.3, 0.46);
      const storm = ridge(t, 0.36, 0.5, 0.68);
      const rain = ridge(t, 0.56, 0.7, 0.86);
      const after = ridge(t, 0.74, 0.92, 1.08);

      const bg = [
        lerp(38, 10, t),
        lerp(40, 12, t),
        lerp(44, 18, t),
      ] as [number, number, number];
      const stormTint = lerp(0, 1, storm);
      ctx.fillStyle = rgba(
        [
          lerp(bg[0], 48, stormTint),
          lerp(bg[1], 8, stormTint),
          lerp(bg[2], 22, stormTint),
        ],
        1,
      );
      if (t < 0.03) {
        ctx.fillRect(0, 0, w, h);
      } else {
        trail(
          ctx,
          lerp(0.28, 0.1, t),
          `${lerp(18, 6, t) | 0},${lerp(18, 8, t) | 0},${lerp(22, 14, t) | 0}`,
        );
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (still > 0) {
        for (const d of dots) {
          const x = d.x * w + Math.sin(time * 0.15 + d.p) * 6;
          const y = d.y * h + Math.cos(time * 0.11 + d.p) * 4;
          glow(ctx, x, y, d.s, [180, 184, 190], 0.35 * still);
        }
      }

      if (noise > 0) {
        ctx.strokeStyle = rgba([210, 210, 220], 0.18 * noise);
        ctx.lineWidth = 1;
        const n = frame.quality === "preview" ? 18 : 46;
        for (let i = 0; i < n; i++) {
          const x = ((hashish(i, time) * w) | 0) + Math.sin(time * 40 + i) * 8 * noise;
          const y = ((hashish(i + 9, time * 0.3) * h) | 0);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 12 + i * 0.3, y + (hashish(i, 3) - 0.5) * 40);
          ctx.stroke();
        }
        for (const s of sparks) {
          s.x = (s.x + s.vx * 0.016) % 1;
          if (s.x < 0) s.x += 1;
          s.y = (s.y + s.vy * 0.016) % 1;
          if (s.y < 0) s.y += 1;
          glow(
            ctx,
            s.x * w,
            s.y * h,
            1.4,
            [230, 230, 240],
            0.55 * noise,
          );
        }
      }

      if (storm > 0) {
        const flash = Math.max(0, Math.sin(time * 7.3) * 0.5 + 0.2) * storm;
        ctx.fillStyle = rgba([90, 20, 40], 0.12 * flash);
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = rgba([255, 120, 160], 0.45 * storm);
        ctx.lineWidth = 1.2;
        const bolts = frame.quality === "preview" ? 2 : 5;
        for (let i = 0; i < bolts; i++) {
          const seed = time * (1.7 + i) + i * 11;
          const x0 = w * (0.15 + 0.7 * hashish(i, Math.floor(time * 2)));
          lightning(
            ctx,
            x0,
            0,
            x0 + Math.sin(seed) * w * 0.2,
            h * (0.45 + hashish(i, 4) * 0.4),
            28 + i * 8,
            seed,
          );
        }
        ctx.strokeStyle = rgba([160, 80, 255], 0.2 * storm);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y =
            h * 0.5 +
            Math.sin(x * 0.01 + time * 3) * 40 * storm +
            Math.sin(x * 0.03 - time * 5) * 18;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (rain > 0) {
        ctx.strokeStyle = rgba([150, 190, 255], 0.35 * rain);
        ctx.lineWidth = 1;
        const speed = reduceMotion ? 0.08 : 0.55;
        for (const d of drops) {
          const y = ((d.y + time * d.v * speed) % 1) * (h + 40) - 20;
          const x = d.x * w + Math.sin(time * 0.4 + d.x * 8) * 10;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 2, y + d.len * rain);
          ctx.stroke();
        }
        glow(ctx, w * 0.5, h * 0.2, 80, [80, 120, 200], 0.08 * rain);
      }

      if (after > 0) {
        const rings = 5;
        for (let i = 0; i < rings; i++) {
          const u = i / rings;
          const r = (40 + i * 70 + Math.sin(time * 0.4 + i) * 8) * lerp(0.4, 1, after);
          ctx.strokeStyle = rgba(
            [255, 214, 170],
            (0.18 - u * 0.03) * after,
          );
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(w * 0.5, h * 0.48, r, 0, TAU);
          ctx.stroke();
        }
        glow(ctx, w * 0.5, h * 0.48, 28, [255, 230, 200], 0.35 * after);
        glow(ctx, w * 0.5, h * 0.48, 90, [120, 160, 220], 0.08 * after);
      }

      ctx.restore();
      grain(ctx, w, h, 0.14 + noise * 0.2 + storm * 0.12);
      vignette(ctx, w, h, 0.5 + storm * 0.2);
    },
  };
}

function hashish(i: number, t: number): number {
  const n = Math.sin(i * 12.9898 + t * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export const weather: Work = {
  id: "weather",
  index: "02",
  title: "Weather Inside Me",
  titleKo: "내 안의 날씨",
  line: "무감각에서 폭풍을 지나, 남은 빛까지.",
  tone: "#9bb7d4",
  durationVh: 780,
  previewT: (time) => 0.5 + Math.sin(time * 0.22) * 0.38,
  captions: [
    { at: 0.06, kicker: "Stillness", line: "Almost nothing moves.", lineKo: "거의 아무것도 움직이지 않는다." },
    { at: 0.26, kicker: "Noise", line: "The air learns how to shake.", lineKo: "공기가 흔들리는 법을 배운다." },
    { at: 0.48, kicker: "Storm", line: "Some weather has no sky.", lineKo: "어떤 날씨에는 하늘이 없다." },
    { at: 0.68, kicker: "Rain", line: "Everything falls in one direction.", lineKo: "모든 것이 한 방향으로 떨어진다." },
    { at: 0.88, kicker: "Afterglow", line: "Some weather does not happen in the sky.", lineKo: "어떤 날씨는 하늘이 아니라 마음에서 일어난다." },
  ],
  create,
};
