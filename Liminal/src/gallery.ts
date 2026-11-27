import { createSurface, prefersReducedMotion } from "./surface";
import { workHref } from "./router";
import { works } from "./works/index";
import { orb, spark } from "./draw";
import type { Frame } from "./types";

export function mountGallery(root: HTMLElement): () => void {
  root.innerHTML = "";
  root.className = "page gallery";

  const hero = document.createElement("section");
  hero.className = "hero";
  hero.innerHTML = `
    <canvas class="hero-canvas"></canvas>
    <div class="hero-copy">
      <h1>LIMINAL</h1>
      <button class="hero-scroll" type="button">enter</button>
    </div>
  `;
  root.appendChild(hero);

  const rooms = document.createElement("section");
  rooms.id = "rooms";
  rooms.className = "rooms";
  const heroScroll = hero.querySelector(".hero-scroll");
  heroScroll?.addEventListener("click", () => {
    rooms.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
  });
  const grid = document.createElement("div");
  grid.className = "room-grid";
  rooms.appendChild(grid);
  root.appendChild(rooms);

  const cleanups: Array<() => void> = [];

  const heroCanvas = hero.querySelector("canvas");
  if (heroCanvas instanceof HTMLCanvasElement) {
    cleanups.push(runHero(hero, heroCanvas));
  }

  for (const work of works) {
    const card = document.createElement("a");
    card.className = "room-card";
    card.href = workHref(work.id);
    card.style.setProperty("--tone", work.tone);
    card.innerHTML = `
      <div class="room-stage"></div>
      <div class="room-meta">
        <span class="room-index">${work.index}</span>
        <h2>${work.title}</h2>
      </div>
    `;
    grid.appendChild(card);
    const stage = card.querySelector(".room-stage");
    if (stage instanceof HTMLElement) {
      cleanups.push(runPreview(stage, work.id));
    }
  }

  return () => {
    for (const fn of cleanups) fn();
    root.innerHTML = "";
  };
}

function runHero(parent: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return () => undefined;
  const reduce = prefersReducedMotion();
  let raf = 0;
  let start = performance.now();
  const dots = Array.from({ length: 420 }, (_, i) => ({
    a: (i / 420) * Math.PI * 2,
    r: 18 + (i % 41) * 11,
    s: 0.6 + (i % 9) * 0.45,
    k: i % 3,
  }));

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(parent);

  const gold: [number, number, number] = [255, 220, 180];
  const ice: [number, number, number] = [180, 210, 255];

  const tick = (now: number) => {
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const time = (now - start) / 1000;
    ctx.fillStyle = "#030308";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const cx = w * 0.5;
    const cy = h * 0.46;
    orb(ctx, cx, cy, Math.min(w, h) * 0.48, gold, 0.2);
    orb(ctx, cx * 1.06, cy * 1.04, Math.min(w, h) * 0.28, ice, 0.12);
    const speed = reduce ? 0.03 : 0.12;
    for (const d of dots) {
      const spin = d.a + time * speed * (0.4 + (d.k + 1) * 0.2);
      const x = cx + Math.cos(spin) * d.r * (w / 860);
      const y = cy + Math.sin(spin) * d.r * 0.5 * (h / 680);
      spark(ctx, x, y, 10 + d.s * 7, d.k === 1 ? ice : gold, 0.42);
    }
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}

function runPreview(stage: HTMLElement, id: string): () => void {
  const work = works.find((w) => w.id === id);
  if (!work) return () => undefined;
  const surface = createSurface(stage, "preview-canvas");
  const renderer = work.create();
  const reduce = prefersReducedMotion();
  let raf = 0;
  let running = false;
  let last = performance.now();
  let elapsed = 0;
  const pointer = { x: 0, y: 0, on: false };

  const frameOf = (now: number): Frame => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    return {
      t: work.previewT(elapsed),
      time: elapsed,
      dt,
      w: surface.w,
      h: surface.h,
      pointerX: pointer.x,
      pointerY: pointer.y,
      pointer: pointer.on,
      quality: "preview",
      reduceMotion: reduce,
    };
  };

  const tick = (now: number) => {
    if (!running) return;
    renderer.draw(surface.ctx, frameOf(now));
    raf = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) {
        if (!running) {
          running = true;
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      } else {
        running = false;
        cancelAnimationFrame(raf);
      }
    },
    { threshold: 0.12 },
  );
  io.observe(stage);

  const onMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    pointer.x = e.clientX - r.left;
    pointer.y = e.clientY - r.top;
    pointer.on = true;
  };
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerleave", () => {
    pointer.on = false;
  });

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    stage.removeEventListener("pointermove", onMove);
    surface.destroy();
  };
}
