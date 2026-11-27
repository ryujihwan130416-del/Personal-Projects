import { lerp, rgba, TAU } from "./math";

type RGB = [number, number, number];

let grainCanvas: HTMLCanvasElement | null = null;
const sprites = new Map<string, HTMLCanvasElement>();

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
    img.data[i + 3] = 22;
  }
  gctx.putImageData(img, 0, 0);
  return grainCanvas;
}

function spriteKey(rgb: RGB): string {
  return `${rgb[0] >> 4},${rgb[1] >> 4},${rgb[2] >> 4}`;
}

function glowSprite(rgb: RGB): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const key = spriteKey(rgb);
  const hit = sprites.get(key);
  if (hit) return hit;
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const g = c.getContext("2d");
  if (!g) return null;
  const r = (rgb[0] >> 4) << 4;
  const ge = (rgb[1] >> 4) << 4;
  const b = (rgb[2] >> 4) << 4;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${r},${ge},${b},1)`);
  grd.addColorStop(0.18, `rgba(${r},${ge},${b},0.55)`);
  grd.addColorStop(0.42, `rgba(${r},${ge},${b},0.18)`);
  grd.addColorStop(1, `rgba(${r},${ge},${b},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

export function spark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rgb: RGB,
  alpha: number,
): void {
  if (alpha <= 0.01 || size <= 0.2) return;
  const s = glowSprite(rgb);
  if (!s) return;
  ctx.globalAlpha = alpha;
  const d = size;
  ctx.drawImage(s, x - d * 0.5, y - d * 0.5, d, d);
  ctx.globalAlpha = 1;
}

export function orb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rgb: RGB,
  alpha: number,
): void {
  if (alpha <= 0.01 || r <= 1) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(rgb, alpha));
  g.addColorStop(0.35, rgba(rgb, alpha * 0.35));
  g.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function trail(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  color = "0,0,0",
): void {
  ctx.fillStyle = `rgba(${color},${alpha})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

export function fill(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
    h * 0.52,
    Math.min(w, h) * 0.18,
    w * 0.5,
    h * 0.52,
    Math.max(w, h) * 0.78,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function neonPath(
  ctx: CanvasRenderingContext2D,
  path: () => void,
  rgb: RGB,
  width: number,
  alpha: number,
): void {
  for (let i = 4; i >= 1; i--) {
    ctx.beginPath();
    path();
    ctx.strokeStyle = rgba(rgb, alpha * (0.045 * i));
    ctx.lineWidth = width * i * 2.4;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.beginPath();
  path();
  ctx.strokeStyle = rgba(rgb, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

export function fbm(x: number, y: number): number {
  return (
    Math.sin(x) * Math.cos(y) * 0.55 +
    Math.sin(x * 1.73 + 1.2) * Math.cos(y * 1.31) * 0.28 +
    Math.sin(x * 3.11 + 0.4) * Math.cos(y * 2.47 + 0.8) * 0.12
  );
}

export function flowAngle(x: number, y: number, t: number): number {
  return fbm(x * 0.0038 + t * 0.17, y * 0.0038 - t * 0.11) * TAU;
}

export function mix3(a: RGB, b: RGB, c: RGB, t: number): RGB {
  if (t < 0.5) return [lerp(a[0], b[0], t * 2), lerp(a[1], b[1], t * 2), lerp(a[2], b[2], t * 2)];
  const u = t * 2 - 1;
  return [lerp(b[0], c[0], u), lerp(b[1], c[1], u), lerp(b[2], c[2], u)];
}
