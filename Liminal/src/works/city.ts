import { glow, grain, trail, vignette } from "../draw";
import { lerp, mulberry32, rgba, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Building = {
  x: number;
  w: number;
  h: number;
  windows: { u: number; v: number }[];
};

type Node = { x: number; y: number; b: number };

function create(): WorkRenderer {
  const rng = mulberry32(0xc17e);
  const buildings: Building[] = [];
  let x = 0.02;
  while (x < 0.98) {
    const bw = 0.04 + rng() * 0.07;
    const bh = 0.18 + rng() * 0.42;
    const windows: Building["windows"] = [];
    const cols = 2 + ((rng() * 3) | 0);
    const rows = 4 + ((rng() * 7) | 0);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rng() > 0.38) {
          windows.push({
            u: (c + 0.5) / cols,
            v: (r + 0.35) / rows,
          });
        }
      }
    }
    buildings.push({ x, w: bw, h: bh, windows });
    x += bw + 0.008 + rng() * 0.012;
  }
  const stars = Array.from({ length: 80 }, () => ({
    x: rng(),
    y: rng() * 0.5,
    s: rng(),
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality } = frame;
      trail(ctx, 0.18, "4,6,14");
      if (t < 0.02) {
        ctx.fillStyle = "#04060e";
        ctx.fillRect(0, 0, w, h);
      }

      const skyline = smoothstep(0.02, 0.2, t);
      const lights = smoothstep(0.18, 0.42, t);
      const wire = smoothstep(0.42, 0.68, t);
      const signal = smoothstep(0.64, 0.92, t);
      const horizon = h * 0.78;

      ctx.save();
      for (const s of stars) {
        const tw = 0.3 + 0.7 * Math.abs(Math.sin(time * (0.6 + s.s) + s.x * 8));
        glow(
          ctx,
          s.x * w,
          s.y * h,
          0.7,
          [200, 220, 255],
          0.25 * tw * (1 - signal * 0.6),
        );
      }

      const nodes: Node[] = [];
      for (const b of buildings) {
        const bx = b.x * w;
        const bw = b.w * w;
        const bh = b.h * h * skyline;
        const top = horizon - bh;
        const buildingAlpha = (1 - signal) * skyline;

        if (buildingAlpha > 0.02) {
          if (wire > 0.55) {
            ctx.strokeStyle = rgba([80, 200, 255], 0.35 * wire * buildingAlpha);
            ctx.lineWidth = 1;
            ctx.strokeRect(bx, top, bw, bh);
          } else {
            ctx.fillStyle = rgba(
              [10, 14, 28],
              0.92 * buildingAlpha * (1 - wire * 0.4),
            );
            ctx.fillRect(bx, top, bw, bh);
            ctx.strokeStyle = rgba([30, 40, 70], 0.5 * buildingAlpha);
            ctx.strokeRect(bx, top, bw, bh);
          }
        }

        for (const win of b.windows) {
          const wx = bx + win.u * bw;
          const wy = top + win.v * bh;
          nodes.push({ x: wx, y: wy, b: lights });
          if (lights > 0 && signal < 0.85) {
            const on = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.7 + wx * 0.05));
            glow(
              ctx,
              wx,
              wy,
              1.4,
              [255, 220, 150],
              0.55 * lights * on * (1 - signal * 0.7),
            );
          }
        }
      }

      ctx.strokeStyle = rgba([8, 10, 18], 1);
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(w, horizon);
      ctx.lineWidth = 2;
      ctx.stroke();

      if (signal > 0.05) {
        ctx.globalCompositeOperation = "lighter";
        const use = quality === "preview" ? nodes.filter((_, i) => i % 3 === 0) : nodes;
        const max = lerp(40, 130, signal);
        ctx.lineWidth = 0.7;
        const cap = quality === "preview" ? 40 : 90;
        for (let i = 0; i < use.length; i++) {
          const a = use[i];
          glow(ctx, a.x, a.y, 1.6, [120, 220, 255], 0.45 * signal);
          let linked = 0;
          for (let j = i + 1; j < use.length && linked < 3; j++) {
            const b = use[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d > max) continue;
            ctx.strokeStyle = rgba([80, 200, 255], (1 - d / max) * 0.22 * signal);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            linked++;
          }
          if (i > cap) break;
        }

        ctx.strokeStyle = rgba([140, 230, 255], 0.12 * signal);
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.35, 40 + Math.sin(time) * 6, 0, TAU);
        ctx.stroke();
      }

      ctx.restore();
      grain(ctx, w, h, 0.12);
      vignette(ctx, w, h, 0.58);
    },
  };
}

export const city: Work = {
  id: "city",
  index: "06",
  title: "City as Signal",
  titleKo: "도시는 신호가 된다",
  line: "밤의 창문이 점과 선, 데이터로 바뀐다.",
  tone: "#7ad4ff",
  durationVh: 740,
  previewT: (time) => 0.35 + Math.sin(time * 0.2) * 0.28,
  captions: [
    { at: 0.08, kicker: "Night", line: "A city holding its breath.", lineKo: "숨을 참고 있는 밤의 도시." },
    { at: 0.28, kicker: "Windows", line: "Windows become points of light.", lineKo: "창문이 점이 된다." },
    { at: 0.52, kicker: "Wire", line: "Buildings forget they were stone.", lineKo: "건물이 선이 된다." },
    { at: 0.76, kicker: "Signal", line: "The city is only a network now.", lineKo: "도시는 신호가 된다." },
    { at: 0.93, kicker: "Grid", line: "City as Signal", lineKo: "도시는 신호가 된다." },
  ],
  create,
};
