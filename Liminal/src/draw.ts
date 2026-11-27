import { rgba, TAU } from "./math";

let grainCanvas: HTMLCanvasElement | null = null;

function getGrain(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (grainCanvas) return grainCanvas;
  grainCanvas = document.createElement("canvas");
  grainCanvas.width = 128;
  grainCanvas.height = 128;
  const gctx = grainCanvas.getContext("2d");
  if (!gctx) return grainCanvas;
  const img = gctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 28;
  }
  gctx.putImageData(img, 0, 0);
  return grainCanvas;
}

export function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function trail(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  color = "0,0,0",
): void {
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: [number, number, number],
  alpha: number,
): void {
  ctx.beginPath();
  ctx.fillStyle = rgba(rgb, alpha * 0.22);
  ctx.arc(x, y, r * 3.2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.fillStyle = rgba(rgb, alpha);
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function grain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha: number,
): void {
  if (alpha <= 0) return;
  const canvas = getGrain();
  if (!canvas) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const pat = ctx.createPattern(canvas, "repeat");
  if (pat) {
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export function vignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
): void {
  const g = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    Math.min(w, h) * 0.2,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function lightning(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  jag: number,
  seed: number,
): void {
  const steps = 10;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  for (let i = 1; i < steps; i++) {
    const u = i / steps;
    const nx = x0 + (x1 - x0) * u;
    const ny = y0 + (y1 - y0) * u;
    const off =
      Math.sin(seed * 17.2 + i * 4.1) *
      jag *
      (1 - Math.abs(u - 0.5) * 1.4);
    const px = -(y1 - y0);
    const py = x1 - x0;
    const len = Math.hypot(px, py) || 1;
    ctx.lineTo(nx + (px / len) * off, ny + (py / len) * off);
  }
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
