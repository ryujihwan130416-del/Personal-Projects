import { TAU, clamp, hash2, lerp, mulberry32 } from "./math";

export type FxFrame = {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  t: number;
  time: number;
  reduce: boolean;
};

type Star = { x: number; y: number; s: number; p: number };
type Mote = { x: number; y: number; s: number; v: number; a: number };

export function createFx(id: string): (frame: FxFrame) => void {
  switch (id) {
    case "origin":
      return originFx();
    case "weather":
      return weatherFx();
    case "bloom":
      return bloomFx();
    case "room":
      return roomFx();
    case "symphony":
      return symphonyFx();
    case "city":
      return cityFx();
    default:
      return () => undefined;
  }
}

function originFx(): (frame: FxFrame) => void {
  const rng = mulberry32(0x0e1914);
  const stars: Star[] = Array.from({ length: 160 }, () => ({
    x: rng(),
    y: rng() * 0.7,
    s: 0.25 + rng() * 0.9,
    p: rng() * TAU,
  }));
  return ({ ctx, w, h, t, time, reduce }) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen";
    const pulse = reduce ? 0.5 : 0.45 + 0.55 * Math.sin(time * 0.0012);
    const wash = ctx.createRadialGradient(w * 0.6, h * 0.36, 20, w * 0.6, h * 0.36, h * 0.5);
    wash.addColorStop(0, `rgba(160,255,210,${0.06 + t * 0.08 + pulse * 0.04})`);
    wash.addColorStop(0.45, `rgba(180,120,255,${0.05 + t * 0.05})`);
    wash.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    for (const s of stars) {
      const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(time * 0.003 + s.p));
      const r = s.s * (0.7 + t * 0.5);
      ctx.fillStyle = `rgba(230,245,255,${0.2 + tw * 0.55})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  };
}

function weatherFx(): (frame: FxFrame) => void {
  const rng = mulberry32(0x0ea7e4);
  const drops = Array.from({ length: 180 }, () => ({
    x: rng(),
    y: rng(),
    l: 14 + rng() * 36,
    v: 0.4 + rng() * 1.1,
  }));
  return ({ ctx, w, h, t, time, reduce }) => {
    ctx.clearRect(0, 0, w, h);
    const ray = ctx.createLinearGradient(w * 0.18, 0, w * 0.55, h * 0.7);
    ray.addColorStop(0, `rgba(255,170,70,${0.05 + t * 0.08})`);
    ray.addColorStop(1, "rgba(255,170,70,0)");
    ctx.fillStyle = ray;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, 0);
    ctx.lineTo(w * 0.28, 0);
    ctx.lineTo(w * 0.72, h);
    ctx.lineTo(w * 0.22, h);
    ctx.fill();
    const speed = reduce ? 0 : time * 0.00032;
    ctx.strokeStyle = `rgba(235,242,255,${0.22 + t * 0.28})`;
    ctx.lineWidth = 1.15;
    for (const d of drops) {
      const y = ((d.y + speed * d.v) % 1) * h;
      const x = (d.x * w + t * 40) % w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 6, y + d.l);
      ctx.stroke();
    }
    const flash = reduce ? 0 : Math.max(0, Math.sin(time * 0.007) - 0.955) * 14;
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flash * 0.14})`;
      ctx.fillRect(0, 0, w, h);
    }
  };
}

function bloomFx(): (frame: FxFrame) => void {
  const rng = mulberry32(0xb100ed);
  const petals: Mote[] = Array.from({ length: 90 }, () => ({
    x: rng(),
    y: rng(),
    s: 5 + rng() * 14,
    v: 0.03 + rng() * 0.14,
    a: rng() * TAU,
  }));
  return ({ ctx, w, h, t, time, reduce }) => {
    ctx.clearRect(0, 0, w, h);
    const haze = ctx.createRadialGradient(w * 0.5, h * 0.55, 20, w * 0.5, h * 0.55, h * 0.7);
    haze.addColorStop(0, `rgba(255,120,160,${0.08 + t * 0.12})`);
    haze.addColorStop(1, "rgba(255,120,160,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
    const drift = reduce ? 0 : time * 0.00007;
    for (const p of petals) {
      const y = ((p.y - drift * p.v - t * 0.18) % 1 + 1) % 1;
      const x = p.x * w + Math.sin(time * 0.0007 + p.a) * 22;
      ctx.save();
      ctx.translate(x, y * h);
      ctx.rotate(p.a + t * 1.4);
      ctx.fillStyle = `rgba(255,${140 + ((p.a * 40) % 70)},${90 + ((p.a * 30) % 80)},${0.4 + t * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.s, p.s * 0.42, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  };
}

function roomFx(): (frame: FxFrame) => void {
  const rng = mulberry32(0x200e11);
  const dust: Mote[] = Array.from({ length: 220 }, () => ({
    x: rng(),
    y: rng(),
    s: 0.5 + rng() * 1.8,
    v: 0.015 + rng() * 0.05,
    a: rng(),
  }));
  return ({ ctx, w, h, t, time, reduce }) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(255,214,150,${0.07 + t * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(w * 0.62, 0);
    ctx.lineTo(w, 0);
    ctx.lineTo(w * 0.42, h);
    ctx.lineTo(w * -0.08, h);
    ctx.closePath();
    ctx.fill();
    const drift = reduce ? 0 : time * 0.000045;
    for (const d of dust) {
      const x = ((d.x + Math.sin(time * 0.00035 + d.a) * 0.025) % 1) * w;
      const y = (((d.y - drift * d.v) % 1) + 1) % 1 * h;
      const inBeam = clamp(1 - Math.abs(x / w - (0.78 - (y / h) * 0.42)) * 2.2, 0, 1);
      ctx.fillStyle = `rgba(255,244,214,${(0.12 + inBeam * 0.7) * (0.45 + t * 0.55)})`;
      ctx.beginPath();
      ctx.arc(x, y, d.s * (0.8 + inBeam), 0, TAU);
      ctx.fill();
    }
  };
}

function symphonyFx(): (frame: FxFrame) => void {
  return ({ ctx, w, h, t, time, reduce }) => {
    ctx.clearRect(0, 0, w, h);
    const cx = w * 0.5;
    const cy = h * 0.4;
    const pulse = reduce ? 0.65 : 0.5 + 0.5 * Math.sin(time * 0.0055);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 11; i++) {
      const ang = (i / 11) * TAU + (reduce ? 0 : time * 0.00022) + t * 0.35;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const g = ctx.createLinearGradient(0, 0, 0, -h * 0.82);
      g.addColorStop(0, `rgba(255,196,90,${0.22 + pulse * 0.16})`);
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.lineTo(w * 0.16, -h * 0.85);
      ctx.lineTo(-w * 0.16, -h * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    const bloom = ctx.createRadialGradient(cx, cy, 4, cx, cy, h * 0.36);
    bloom.addColorStop(0, `rgba(255,250,220,${0.28 + t * 0.25})`);
    bloom.addColorStop(0.35, `rgba(255,170,60,${0.12 + pulse * 0.08})`);
    bloom.addColorStop(1, "rgba(255,120,40,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.36, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  };
}

function cityFx(): (frame: FxFrame) => void {
  return ({ ctx, w, h, t, time }) => {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen";
    const wash = ctx.createLinearGradient(0, h * 0.35, 0, h);
    wash.addColorStop(0, "rgba(80,40,120,0)");
    wash.addColorStop(1, `rgba(255,70,90,${0.08 + t * 0.12})`);
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const gx = hash2(i, 3);
      const gy = 0.22 + hash2(i, 7) * 0.7;
      const on = 0.5 + 0.5 * Math.sin(time * 0.0026 + i) > 0.28;
      if (!on) continue;
      ctx.fillStyle = `rgba(255,214,130,${0.22 + hash2(i, 9) * 0.5})`;
      ctx.fillRect(gx * w, gy * h, 2 + hash2(i, 2) * 4, 1.6 + hash2(i, 4) * 2.4);
    }
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) {
      const x0 = w * (0.35 + k * 0.08);
      ctx.strokeStyle = `rgba(255,190,80,${0.12 + t * 0.2})`;
      ctx.beginPath();
      ctx.moveTo(x0, h);
      ctx.lineTo(w * 0.5, h * 0.42);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const u = (hash2(i + k * 10, 11) + time * 0.00014 * (0.3 + hash2(i, 5))) % 1;
        ctx.fillStyle = `rgba(255,230,160,${0.45 + t * 0.4})`;
        ctx.beginPath();
        ctx.arc(lerp(x0, w * 0.5, u), lerp(h, h * 0.42, u), 1.5, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
  };
}
