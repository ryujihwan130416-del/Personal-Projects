import { glow, grain, trail, vignette } from "../draw";
import { mulberry32, rgba, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Branch = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  depth: number;
  kind: "root" | "stem" | "twig";
  appear: number;
};

type PetalBit = { a: number; r: number; spin: number };

function grow(
  list: Branch[],
  x: number,
  y: number,
  angle: number,
  depth: number,
  max: number,
  kind: Branch["kind"],
  rng: () => number,
  appear: number,
): void {
  if (depth > max) return;
  const len =
    kind === "root"
      ? 0.034 + rng() * 0.05
      : kind === "stem"
        ? 0.06 + rng() * 0.02
        : 0.03 + rng() * 0.04;
  const x2 = x + Math.cos(angle) * len;
  const y2 = y + Math.sin(angle) * len;
  list.push({ x1: x, y1: y, x2, y2, depth, kind, appear });
  const spread = kind === "root" ? 0.7 : 0.42;
  if (rng() > 0.18 || depth < 2) {
    grow(
      list,
      x2,
      y2,
      angle - spread * (0.4 + rng()),
      depth + 1,
      max,
      kind === "stem" && depth > 2 ? "twig" : kind,
      rng,
      appear + 0.03 + rng() * 0.02,
    );
  }
  if (rng() > 0.28) {
    grow(
      list,
      x2,
      y2,
      angle + spread * (0.4 + rng()),
      depth + 1,
      max,
      kind === "stem" && depth > 2 ? "twig" : kind,
      rng,
      appear + 0.03 + rng() * 0.02,
    );
  }
}

function create(): WorkRenderer {
  const rng = mulberry32(0xb100d);
  const branches: Branch[] = [];
  grow(branches, 0.5, 0.8, Math.PI * 0.5, 0, 7, "root", rng, 0.08);
  grow(branches, 0.5, 0.8, -Math.PI * 0.5, 0, 6, "stem", rng, 0.22);
  grow(branches, 0.5, 0.8, -Math.PI * 0.5 + 0.08, 0, 5, "stem", rng, 0.28);
  const petals: PetalBit[] = Array.from({ length: 18 }, (_, i) => ({
    a: (i / 18) * TAU,
    r: 0.7 + rng() * 0.5,
    spin: (rng() - 0.5) * 0.08,
  }));
  const dust = Array.from({ length: 160 }, () => ({
    a: rng() * TAU,
    r: rng(),
    s: 0.6 + rng() * 1.8,
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h } = frame;
      const soil = h * 0.8;
      trail(ctx, 0.2, "4,8,6");
      ctx.fillStyle = rgba([6, 10, 8], 1);
      if (t < 0.02) ctx.fillRect(0, 0, w, h);

      const ground = ctx.createLinearGradient(0, soil - 40, 0, h);
      ground.addColorStop(0, "rgba(18, 28, 18, 0)");
      ground.addColorStop(1, "rgba(12, 16, 10, 0.9)");
      ctx.fillStyle = ground;
      ctx.fillRect(0, soil - 40, w, h - soil + 40);

      ctx.strokeStyle = rgba([40, 52, 32], 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, soil);
      for (let x = 0; x <= w; x += 12) {
        ctx.lineTo(x, soil + Math.sin(x * 0.02) * 3);
      }
      ctx.stroke();

      const dissolve = smoothstep(0.78, 1, t);
      const open = smoothstep(0.52, 0.74, t);

      ctx.save();
      for (const b of branches) {
        const vis = smoothstep(b.appear, b.appear + 0.12, t) * (1 - dissolve * 0.85);
        if (vis <= 0.02) continue;
        const x1 = b.x1 * w;
        const y1 = b.y1 * h;
        const x2 = b.x2 * w;
        const y2 = b.y2 * h;
        ctx.strokeStyle =
          b.kind === "root"
            ? rgba([90, 70, 48], 0.55 * vis)
            : b.kind === "stem"
              ? rgba([130, 170, 110], 0.7 * vis)
              : rgba([170, 210, 140], 0.55 * vis);
        ctx.lineWidth = Math.max(0.7, 4.2 - b.depth * 0.55);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.restore();

      const tips = branches
        .filter((b) => b.kind !== "root")
        .sort((a, b) => a.y2 - b.y2)
        .slice(0, 8);
      const hx = tips.length
        ? (tips.reduce((sum, b) => sum + b.x2, 0) / tips.length) * w
        : w * 0.5;
      const hy = tips.length ? tips[0].y2 * h : h * 0.42;
      if (open > 0) {
        const fade = open * (1 - dissolve * 0.85);
        ctx.save();
        for (const p of petals) {
          const ang = p.a + time * p.spin;
          const len = (48 + p.r * 38) * open;
          drawPetal(ctx, hx, hy, ang, len, 16 + p.r * 6, fade, p.r);
        }
        for (const p of petals) {
          const ang = p.a + Math.PI / 18 + time * p.spin * 0.6;
          const len = (26 + p.r * 18) * open;
          drawPetal(ctx, hx, hy, ang, len, 10, fade * 0.9, 0.2);
        }
        glow(ctx, hx, hy, 7, [255, 236, 180], 0.55 * fade);
        ctx.beginPath();
        ctx.fillStyle = rgba([255, 244, 210], 0.9 * fade);
        ctx.arc(hx, hy, 5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      if (dissolve > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (const d of dust) {
          const dist = 20 + d.r * 180 * dissolve;
          const x = hx + Math.cos(d.a + time * 0.15) * dist;
          const y = hy + Math.sin(d.a + time * 0.12) * dist * 0.7 - dissolve * 40;
          glow(
            ctx,
            x,
            y,
            d.s,
            d.r > 0.5 ? [255, 190, 200] : [180, 220, 160],
            0.55 * dissolve,
          );
        }
        ctx.restore();
      }

      grain(ctx, w, h, 0.1);
      vignette(ctx, w, h, 0.48);
    },
  };
}

function drawPetal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  alpha: number,
  tint: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(width, length * 0.25, width * 0.85, length * 0.7, 0, length);
  ctx.bezierCurveTo(-width * 0.85, length * 0.7, -width, length * 0.25, 0, 0);
  ctx.fillStyle = rgba(
    [255, 150 + tint * 70, 168 + tint * 20],
    0.72 * alpha,
  );
  ctx.fill();
  ctx.strokeStyle = rgba([255, 210, 220], 0.35 * alpha);
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.restore();
}

export const bloom: Work = {
  id: "bloom",
  index: "03",
  title: "Digital Bloom",
  titleKo: "스크롤로 피어나는 정원",
  line: "흙에서 뿌리, 줄기, 꽃, 그리고 흩어지는 픽셀.",
  tone: "#c9e0b8",
  durationVh: 740,
  previewT: (time) => 0.58 + Math.sin(time * 0.28) * 0.16,
  captions: [
    { at: 0.06, kicker: "Soil", line: "Only the ground, waiting.", lineKo: "아직 흙뿐이다." },
    { at: 0.24, kicker: "Roots", line: "Roots make a path before the light.", lineKo: "뿌리가 먼저 길을 만든다." },
    { at: 0.46, kicker: "Stem", line: "A stem remembers the sky.", lineKo: "줄기는 빛을 기억한다." },
    { at: 0.66, kicker: "Bloom", line: "The flower opens as if it had always been open.", lineKo: "꽃이 열린다." },
    { at: 0.88, kicker: "Scatter", line: "Then it becomes pixels, and keeps blooming.", lineKo: "그리고 픽셀로 흩어진다." },
  ],
  create,
};
