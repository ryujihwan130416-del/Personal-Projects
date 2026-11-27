import { grain, orb, spark, trail, vignette } from "../draw";
import { lerp, mulberry32, smoothstep } from "../math";
import type { Work, WorkRenderer } from "../types";

type Mote = { x: number; y: number; vx: number; vy: number; s: number; z: number };

function create(): WorkRenderer {
  const rng = mulberry32(0x5004);
  const motes: Mote[] = Array.from({ length: 900 }, () => ({
    x: rng(),
    y: rng(),
    vx: (rng() - 0.5) * 0.0004,
    vy: (rng() - 0.35) * 0.0003,
    s: 0.4 + rng() * 1.5,
    z: rng(),
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality, reduceMotion, pointer, pointerX } = frame;
      const n = quality === "preview" || reduceMotion ? 220 : motes.length;
      trail(ctx, 0.14, "10,8,6");

      const roomIn = smoothstep(0.02, 0.22, t);
      const light = smoothstep(0.12, 0.5, t);
      const dissolve = smoothstep(0.62, 0.92, t);
      const empty = smoothstep(0.86, 1, t);
      const amber: [number, number, number] = [255, 196, 120];
      const cream: [number, number, number] = [255, 232, 200];
      const dusk: [number, number, number] = [80, 100, 140];

      const wx = w * 0.5 + (pointer ? (pointerX - w * 0.5) * 0.02 : 0);
      const wy = h * 0.34;
      const ww = Math.min(w, h) * 0.22 * roomIn;
      const wh = Math.min(w, h) * 0.28 * roomIn;
      const floorY = h * 0.78;

      ctx.save();
      ctx.globalAlpha = roomIn * (1 - empty) * 0.45;
      ctx.fillStyle = "rgba(22, 16, 12, 1)";
      ctx.beginPath();
      ctx.moveTo(w * 0.12, floorY);
      ctx.lineTo(w * 0.88, floorY);
      ctx.lineTo(w * 0.7, h * 0.52);
      ctx.lineTo(w * 0.3, h * 0.52);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      orb(ctx, wx, wy, Math.min(w, h) * 0.55, amber, 0.16 * light * (1 - empty * 0.7));
      orb(ctx, wx, wy, ww * 0.9, cream, 0.28 * light);
      orb(ctx, wx, floorY - 20, w * 0.35, amber, 0.08 * light);

      const shaft = quality === "preview" ? 40 : 90;
      for (let i = 0; i < shaft; i++) {
        const u = i / shaft;
        const x = lerp(wx - ww * 0.35, wx + ww * 0.35, u) + Math.sin(time * 0.4 + i) * 6;
        const y1 = wy + wh * 0.2;
        const y2 = floorY - 10;
        ctx.strokeStyle = `rgba(255,210,150,${0.03 * light})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y1);
        ctx.lineTo(lerp(x, w * 0.5, 0.25), y2);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      const motion = reduceMotion ? 0.3 : 1;
      for (let i = 0; i < n; i++) {
        const m = motes[i];
        const inShaft = Math.abs(m.x - 0.5) < 0.18 && m.y > 0.28 && m.y < 0.8;
        m.vy -= inShaft ? 0.00005 * light * motion : 0;
        m.x += m.vx * motion + Math.sin(time * 0.3 + m.z * 8) * 0.00015;
        m.y += m.vy * motion;
        if (dissolve > 0) {
          m.x += (m.x - 0.5) * 0.0012 * dissolve;
          m.y += -0.0008 * dissolve;
        }
        if (m.x < 0 || m.x > 1 || m.y < 0 || m.y > 1) {
          m.x = rng();
          m.y = rng();
          m.vy = (rng() - 0.35) * 0.0003;
        }
        const rgb = inShaft ? cream : m.z > 0.7 ? dusk : amber;
        const a =
          (inShaft ? 0.42 : 0.16) * (0.55 + m.z) * (roomIn + 0.25) * (1 - empty * 0.35);
        spark(ctx, m.x * w, m.y * h, m.s * lerp(7, 14, light), rgb, a);
      }

      ctx.restore();
      grain(ctx, w, h, 0.1);
      vignette(ctx, w, h, 0.55);
    },
  };
}

export const room: Work = {
  id: "room",
  index: "04",
  title: "Room of Forgotten Things",
  titleKo: "잊힌 것들의 방",
  tone: "#e2c39a",
  durationVh: 840,
  previewT: (time) => 0.45 + Math.sin(time * 0.2) * 0.1,
  create,
};
