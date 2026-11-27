import { glow, grain, trail, vignette } from "../draw";
import { mulberry32, rgba, smoothstep, TAU } from "../math";
import type { Work, WorkRenderer } from "../types";

type Pt = { x: number; y: number };

function project(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
): Pt & { s: number } {
  const fov = 520;
  const s = (fov / (fov + z)) * 1.45;
  return { x: w * 0.5 + x * s, y: h * 0.52 + y * s, s };
}

type Speck = { x: number; y: number; vx: number; vy: number; life: number; rgb: [number, number, number] };

function create(): WorkRenderer {
  const rng = mulberry32(0x5004);
  const specks: Speck[] = [];
  const idle = Array.from({ length: 40 }, () => ({
    x: rng(),
    y: rng(),
    s: rng(),
  }));

  function burst(
    x: number,
    y: number,
    rgb: [number, number, number],
    n: number,
    amount: number,
  ): void {
    if (amount < 0.4 || specks.length > 280) return;
    for (let i = 0; i < n; i++) {
      specks.push({
        x,
        y,
        vx: (rng() - 0.5) * 2.2,
        vy: (rng() - 0.8) * 2.4,
        life: 1,
        rgb,
      });
    }
  }

  return {
    draw(ctx, frame) {
      const { t, time, w, h } = frame;
      trail(ctx, 0.22, "8,7,6");
      ctx.fillStyle = "#0c0a09";
      if (t < 0.02) ctx.fillRect(0, 0, w, h);

      const roomIn = smoothstep(0.04, 0.18, t);
      const windowIn = smoothstep(0.16, 0.3, t);
      const objects = smoothstep(0.28, 0.5, t);
      const dissolve = smoothstep(0.58, 0.84, t);
      const empty = smoothstep(0.78, 1, t);
      const presence = (1 - empty) * roomIn;

      const back = {
        l: project(-210, -150, 380, w, h),
        r: project(210, -150, 380, w, h),
        rb: project(210, 90, 380, w, h),
        lb: project(-210, 90, 380, w, h),
      };
      const near = {
        l: project(-340, -40, 40, w, h),
        r: project(340, -40, 40, w, h),
        rb: project(340, 220, 40, w, h),
        lb: project(-340, 220, 40, w, h),
      };

      ctx.save();
      ctx.globalAlpha = presence;

      ctx.fillStyle = rgba([48, 40, 36], 0.96);
      ctx.beginPath();
      ctx.moveTo(back.l.x, back.l.y);
      ctx.lineTo(back.r.x, back.r.y);
      ctx.lineTo(back.rb.x, back.rb.y);
      ctx.lineTo(back.lb.x, back.lb.y);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = rgba([32, 26, 22], 0.96);
      ctx.beginPath();
      ctx.moveTo(back.lb.x, back.lb.y);
      ctx.lineTo(back.rb.x, back.rb.y);
      ctx.lineTo(near.rb.x, near.rb.y);
      ctx.lineTo(near.lb.x, near.lb.y);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = rgba([140, 120, 100], 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(near.l.x, near.l.y);
      ctx.lineTo(back.l.x, back.l.y);
      ctx.lineTo(back.r.x, back.r.y);
      ctx.lineTo(near.r.x, near.r.y);
      ctx.moveTo(back.lb.x, back.lb.y);
      ctx.lineTo(near.lb.x, near.lb.y);
      ctx.moveTo(back.rb.x, back.rb.y);
      ctx.lineTo(near.rb.x, near.rb.y);
      ctx.stroke();

      const wl = project(-70, -90, 378, w, h);
      const wr = project(70, -90, 378, w, h);
      const wrb = project(70, 10, 378, w, h);
      const wlb = project(-70, 10, 378, w, h);
      ctx.globalAlpha = presence * windowIn;
      const night = ctx.createLinearGradient(wl.x, wl.y, wr.x, wrb.y);
      night.addColorStop(0, "rgba(90, 120, 170, 0.95)");
      night.addColorStop(1, "rgba(30, 40, 70, 0.95)");
      ctx.fillStyle = night;
      ctx.beginPath();
      ctx.moveTo(wl.x, wl.y);
      ctx.lineTo(wr.x, wr.y);
      ctx.lineTo(wrb.x, wrb.y);
      ctx.lineTo(wlb.x, wlb.y);
      ctx.closePath();
      ctx.fill();
      glow(
        ctx,
        (wl.x + wr.x) / 2,
        (wl.y + wrb.y) / 2,
        70,
        [255, 210, 150],
        0.28 * windowIn * (1 - dissolve),
      );

      const objA = objects * (1 - dissolve);
      ctx.globalAlpha = presence * objA;

      const chair = project(-120, 70, 180, w, h);
      drawChair(ctx, chair.x, chair.y, chair.s);
      const letter = project(70, 88, 150, w, h);
      drawLetter(ctx, letter.x, letter.y, letter.s, time);
      const photo = project(140, -40, 370, w, h);
      drawFrame(ctx, photo.x, photo.y, photo.s);
      const lamp = project(-40, -120, 220, w, h);
      drawLamp(ctx, lamp.x, lamp.y, lamp.s, time);

      ctx.restore();

      if (dissolve > 0.05 && empty < 0.95) {
        burst(chair.x, chair.y, [160, 130, 100], 2, dissolve);
        burst(letter.x, letter.y, [230, 220, 200], 2, dissolve);
        burst(photo.x, photo.y, [190, 170, 140], 1, dissolve);
        burst(lamp.x, lamp.y + 20, [255, 200, 120], 2, dissolve);
      }

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = specks.length - 1; i >= 0; i--) {
        const s = specks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.02;
        s.life -= 0.012;
        if (s.life <= 0) {
          specks.splice(i, 1);
          continue;
        }
        glow(ctx, s.x, s.y, 1.4, s.rgb, s.life * 0.7);
      }
      ctx.restore();

      if (empty > 0.2) {
        for (const d of idle) {
          glow(
            ctx,
            d.x * w,
            d.y * h,
            0.8,
            [200, 190, 180],
            0.15 * empty * (0.4 + d.s),
          );
        }
      }

      grain(ctx, w, h, 0.16);
      vignette(ctx, w, h, 0.62);
    },
  };
}

function drawChair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  ctx.strokeStyle = rgba([150, 120, 90], 0.85);
  ctx.lineWidth = 1.6;
  const w = 36 * s;
  const h = 46 * s;
  ctx.strokeRect(x - w * 0.5, y - h * 0.35, w, h * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.35);
  ctx.lineTo(x - w * 0.5, y - h * 0.85);
  ctx.lineTo(x + w * 0.5, y - h * 0.85);
  ctx.lineTo(x + w * 0.5, y - h * 0.35);
  ctx.moveTo(x - w * 0.45, y - h * 0.07);
  ctx.lineTo(x - w * 0.45, y + h * 0.35);
  ctx.moveTo(x + w * 0.45, y - h * 0.07);
  ctx.lineTo(x + w * 0.45, y + h * 0.35);
  ctx.stroke();
}

function drawLetter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.2 + Math.sin(time * 0.2) * 0.02);
  ctx.fillStyle = rgba([236, 228, 210], 0.9);
  ctx.fillRect(-18 * s, -12 * s, 36 * s, 24 * s);
  ctx.strokeStyle = rgba([180, 160, 130], 0.7);
  ctx.strokeRect(-18 * s, -12 * s, 36 * s, 24 * s);
  ctx.strokeStyle = rgba([160, 140, 120], 0.5);
  ctx.beginPath();
  ctx.moveTo(-12 * s, -4 * s);
  ctx.lineTo(10 * s, -4 * s);
  ctx.moveTo(-12 * s, 2 * s);
  ctx.lineTo(6 * s, 2 * s);
  ctx.stroke();
  ctx.restore();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  ctx.strokeStyle = rgba([170, 140, 100], 0.8);
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 16 * s, y - 22 * s, 32 * s, 40 * s);
  ctx.fillStyle = rgba([50, 40, 32], 0.7);
  ctx.fillRect(x - 12 * s, y - 18 * s, 24 * s, 32 * s);
  glow(ctx, x, y, 6 * s, [200, 160, 110], 0.2);
}

function drawLamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  time: number,
): void {
  ctx.strokeStyle = rgba([200, 180, 140], 0.7);
  ctx.beginPath();
  ctx.moveTo(x, y - 50 * s);
  ctx.lineTo(x, y);
  ctx.stroke();
  const pulse = 0.45 + Math.sin(time * 1.3) * 0.08;
  glow(ctx, x, y + 8 * s, 14 * s, [255, 210, 130], pulse);
  ctx.beginPath();
  ctx.arc(x, y + 8 * s, 6 * s, 0, TAU);
  ctx.fillStyle = rgba([255, 230, 180], 0.8);
  ctx.fill();
}

export const room: Work = {
  id: "room",
  index: "04",
  title: "Room of Forgotten Things",
  titleKo: "잊힌 것들의 방",
  line: "빈 방에 사물이 돌아오고, 다시 가루가 된다.",
  tone: "#d4b48a",
  durationVh: 760,
  previewT: (time) => 0.4 + Math.sin(time * 0.25) * 0.12,
  captions: [
    { at: 0.06, kicker: "Empty", line: "A room that has been waiting.", lineKo: "기다리고 있던 빈 방." },
    { at: 0.24, kicker: "Window", line: "The window returns first.", lineKo: "창문이 먼저 돌아온다." },
    { at: 0.44, kicker: "Things", line: "A chair, a letter, a name without a voice.", lineKo: "의자와 편지, 잊힌 이름들." },
    { at: 0.66, kicker: "Dust", line: "Touch them and they become powder.", lineKo: "만지면 가루가 된다." },
    { at: 0.9, kicker: "Remain", line: "What remains is the looking.", lineKo: "남는 것은 바라봄뿐이다." },
  ],
  create,
};
