import { glow, grain, trail, vignette } from "../draw";
import { lerp, mulberry32, rgba, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Particle = {
  a: number;
  r: number;
  s: number;
  o: number;
  birth: number;
  hue: [number, number, number];
  links: [number, number, number];
};

function makeParticles(n: number): Particle[] {
  const rng = mulberry32(0x0e1914);
  const particles: Particle[] = [];
  for (let i = 0; i < n; i++) {
    particles.push({
      a: rng() * TAU,
      r: 20 + rng() * 240,
      s: 0.6 + rng() * 2.2,
      o: (rng() - 0.5) * 0.35,
      birth: rng() * 0.72,
      hue:
        rng() > 0.78
          ? [255, 214, 160]
          : rng() > 0.4
            ? [255, 248, 236]
            : [180, 210, 255],
      links: [0, 0, 0],
    });
  }
  for (let i = 0; i < n; i++) {
    particles[i].links = [
      (i + 1) % n,
      (i + 7) % n,
      (i + 19 + ((i * 3) % 11)) % n,
    ];
  }
  return particles;
}

function create(): WorkRenderer {
  const particles = makeParticles(420);

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion } = frame;
      const n = quality === "preview" || reduceMotion ? 140 : particles.length;

      const fade = lerp(0.42, 0.1, t);
      if (t < 0.02) {
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, w, h);
      } else {
        trail(ctx, fade);
      }

      const cx = w * 0.5 + (frame.pointer ? (frame.pointerX - w * 0.5) * 0.04 : 0);
      const cy = h * 0.5 + (frame.pointer ? (frame.pointerY - h * 0.5) * 0.04 : 0);
      const born = smoothstep(0, 0.78, t);
      const connect = smoothstep(0.28, 0.62, t);
      const core = smoothstep(0.55, 0.92, t);
      const scale = lerp(0.18, 1.05, t);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      if (core > 0) {
        const cr = lerp(6, Math.min(w, h) * 0.08, core);
        glow(ctx, cx, cy, cr, [255, 236, 210], 0.16 * core);
        glow(ctx, cx, cy, cr * 0.28, [255, 252, 245], 0.35 * core);
      }

      ctx.lineWidth = 0.7;
      for (let i = 0; i < n; i++) {
        const p = particles[i];
        if (t < p.birth) continue;
        const life = smoothstep(p.birth, p.birth + 0.18, t);
        const spin = p.a + time * p.o * (reduceMotion ? 0.15 : 1);
        const pulse = Math.sin(time * 0.7 + p.a) * 6;
        const rad = p.r * scale * born + pulse;
        const x = cx + Math.cos(spin) * rad;
        const y = cy + Math.sin(spin) * rad * 0.86;
        const a = life * lerp(0.15, 0.95, t);

        if (connect > 0.05) {
          for (const idx of p.links) {
            if (idx >= n) continue;
            const q = particles[idx];
            if (t < q.birth) continue;
            const qspin = q.a + time * q.o * (reduceMotion ? 0.15 : 1);
            const qrad = q.r * scale * born + Math.sin(time * 0.7 + q.a) * 6;
            const qx = cx + Math.cos(qspin) * qrad;
            const qy = cy + Math.sin(qspin) * qrad * 0.86;
            const dist = Math.hypot(qx - x, qy - y);
            const max = 90 + 70 * t;
            if (dist > max) continue;
            ctx.strokeStyle = rgba(
              p.hue,
              (1 - dist / max) * 0.22 * connect * life,
            );
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(qx, qy);
            ctx.stroke();
          }
        }

        glow(ctx, x, y, p.s * life, p.hue, a);
      }

      ctx.restore();
      grain(ctx, w, h, 0.12 + t * 0.08);
      vignette(ctx, w, h, 0.55);
    },
  };
}

export const origin: Work = {
  id: "origin",
  index: "01",
  title: "Origin of Light",
  titleKo: "빛은 천천히 태어난다",
  line: "어둠에서 입자가 서로를 찾아 하나의 형태가 된다.",
  tone: "#e8d5b5",
  durationVh: 720,
  previewT: (time) => 0.42 + Math.sin(time * 0.35) * 0.18,
  captions: [
    { at: 0.06, kicker: "00", line: "Nothing yet.", lineKo: "아직 아무것도 없다." },
    {
      at: 0.24,
      kicker: "01",
      line: "A particle remembers it can shine.",
      lineKo: "한 점이 빛날 수 있다는 것을 기억한다.",
    },
    {
      at: 0.48,
      kicker: "02",
      line: "Then they find each other.",
      lineKo: "그리고 서로를 찾는다.",
    },
    {
      at: 0.7,
      kicker: "03",
      line: "Form is only light agreeing to stay.",
      lineKo: "형태는 빛이 머물기로 한 약속이다.",
    },
    {
      at: 0.9,
      kicker: "04",
      line: "Origin of Light",
      lineKo: "빛은 천천히 태어난다.",
    },
  ],
  create,
};
