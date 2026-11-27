export type Surface = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  resize: () => void;
  destroy: () => void;
};

export function createSurface(
  parent: HTMLElement,
  className: string,
): Surface {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("canvas unsupported");
  parent.appendChild(canvas);

  const surface: Surface = {
    canvas,
    ctx,
    w: 1,
    h: 1,
    resize: () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = parent.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      if (w === surface.w && h === surface.h && canvas.width === Math.floor(w * dpr)) {
        return;
      }
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      surface.w = w;
      surface.h = h;
    },
    destroy: () => {
      ro.disconnect();
      canvas.remove();
    },
  };

  const ro = new ResizeObserver(() => surface.resize());
  ro.observe(parent);
  surface.resize();
  return surface;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
