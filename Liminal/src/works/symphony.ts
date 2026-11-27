import { glow, grain, trail, vignette } from "../draw";
import { lerp, rgba, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

function create(): WorkRenderer {
  const nodes = Array.from({ length: 36 }, (_, i) => ({
    a: (i / 36) * TAU,
    r: 0.35 + (i % 5) * 0.08,
    p: i * 0.37,
  }));

  return {
    draw(ctx, frame) {
      const { t, time, w, h, quality } = frame;
      trail(ctx, 0.16, "6,4,14");
      if (t < 0.02) {
        ctx.fillStyle = "#070510";
        ctx.fillRect(0, 0, w, h);
      }

      const cx = w * 0.5;
      const cy = h * 0.48;
      const beat = 0.5 + 0.5 * Math.sin(time * 2.2 + t * 8);
      const m1 = smoothstep(0.0, 0.22, t);
      const m2 = smoothstep(0.18, 0.48, t);
      const m3 = smoothstep(0.42, 0.72, t);
      const m4 = smoothstep(0.68, 0.95, t);
      const merge = smoothstep(0.82, 1, t);

      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const dots = quality === "preview" ? 18 : nodes.length;
      for (let i = 0; i < dots; i++) {
        const n = nodes[i];
        const pulse = 0.55 + 0.45 * Math.sin(time * (1.4 + n.p * 0.2) + n.a * 3);
        const rad = lerp(40, Math.min(w, h) * n.r, m1) * (1 - merge * 0.7);
        const x = cx + Math.cos(n.a + time * 0.12) * rad;
        const y = cy + Math.sin(n.a + time * 0.12) * rad * 0.78;
        const rgb: [number, number, number] =
          i % 3 === 0 ? [255, 120, 200] : i % 3 === 1 ? [120, 180, 255] : [255, 220, 140];
        glow(ctx, x, y, 2 + pulse * 2.5, rgb, 0.45 * m1 * pulse);
      }

      if (m2 > 0) {
        ctx.strokeStyle = rgba([180, 160, 255], 0.28 * m2);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        const amp = 28 * m2 * (1 + beat * 0.35) * (1 - merge * 0.5);
        const freq = 0.018 + t * 0.01;
        for (let x = 0; x <= w; x += 4) {
          const y =
            cy +
            Math.sin(x * freq + time * 3.2) * amp +
            Math.sin(x * freq * 2.3 - time * 2) * amp * 0.35;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      if (m3 > 0) {
        const rings = 6;
        for (let i = 0; i < rings; i++) {
          const u = (i / rings + time * 0.08) % 1;
          const r = lerp(20, Math.min(w, h) * 0.42, u) * m3;
          ctx.strokeStyle = rgba(
            [255, 90 + i * 20, 180],
            (1 - u) * 0.22 * m3 * (1 - merge),
          );
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, TAU);
          ctx.stroke();
        }
      }

      if (m4 > 0) {
        const waves = 3;
        for (let k = 0; k < waves; k++) {
          ctx.strokeStyle = rgba(
            [255, 230, 210],
            0.2 * m4 * (1 - k * 0.25),
          );
          ctx.lineWidth = 1.6 - k * 0.3;
          ctx.beginPath();
          for (let x = 0; x <= w; x += 3) {
            const y =
              cy +
              Math.sin(x * 0.012 + time * (2 + k) + k) *
                (50 - k * 12) *
                m4 *
                lerp(1, 0.25, merge);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        glow(ctx, cx, cy, lerp(8, 36, merge), [255, 240, 220], 0.22 * m4);
      }

      ctx.restore();
      grain(ctx, w, h, 0.1);
      vignette(ctx, w, h, 0.55);
    },
  };
}

export const symphony: Work = {
  id: "symphony",
  index: "05",
  title: "Silent Symphony",
  titleKo: "들리지 않는 음악",
  line: "점과 선과 색이 박자를 대신한다.",
  tone: "#d09cff",
  durationVh: 720,
  previewT: (time) => 0.55 + Math.sin(time * 0.4) * 0.2,
  captions: [
    { at: 0.08, kicker: "I", line: "The first beat is a point.", lineKo: "첫 박은 하나의 점이다." },
    { at: 0.3, kicker: "II", line: "A line learns rhythm.", lineKo: "선이 리듬을 배운다." },
    { at: 0.54, kicker: "III", line: "Color stands in for sound.", lineKo: "색이 소리를 대신한다." },
    { at: 0.78, kicker: "IV", line: "Every note becomes one wave.", lineKo: "모든 음이 하나의 파동으로." },
    { at: 0.94, kicker: "Coda", line: "Silent Symphony", lineKo: "들리지 않는 음악." },
  ],
  create,
};
