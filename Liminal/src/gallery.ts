import { createSurface, prefersReducedMotion } from "./surface";
import { galleryHref, workHref } from "./router";
import { works } from "./works/index";
import type { Frame } from "./types";

export function mountGallery(root: HTMLElement): () => void {
  root.innerHTML = "";
  root.className = "page gallery";

  const hero = document.createElement("section");
  hero.className = "hero";
  hero.innerHTML = `
    <canvas class="hero-canvas"></canvas>
    <div class="hero-copy">
      <p class="kicker">Exhibition</p>
      <h1>LIMINAL</h1>
      <p class="hero-sub">스크롤로 들어가는 여섯 개의 방</p>
      <p class="hero-line">Six rooms of digital art. Scroll is the only instrument.</p>
      <button class="hero-scroll" type="button">아래로 내려 전시를 시작하세요</button>
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
  rooms.innerHTML = `<p class="rooms-label">Rooms</p>`;
  const grid = document.createElement("div");
  grid.className = "room-grid";
  rooms.appendChild(grid);
  root.appendChild(rooms);

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `<p>스크롤은 시간이다. <a href="${galleryHref()}">Liminal</a></p>`;
  root.appendChild(footer);

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
        <p class="room-ko">${work.titleKo}</p>
        <p class="room-line">${work.line}</p>
        <span class="room-enter">입장</span>
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
  const dots = Array.from({ length: 80 }, (_, i) => ({
    a: (i / 80) * Math.PI * 2,
    r: 40 + (i % 17) * 12,
    s: 0.6 + (i % 5) * 0.3,
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

  const tick = (now: number) => {
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const time = (now - start) / 1000;
    ctx.fillStyle = "#050507";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const cx = w * 0.5;
    const cy = h * 0.46;
    for (const d of dots) {
      const spin = d.a + time * (reduce ? 0.02 : 0.08);
      const x = cx + Math.cos(spin) * d.r * (w / 900);
      const y = cy + Math.sin(spin) * d.r * 0.55 * (h / 700);
      ctx.beginPath();
      ctx.fillStyle = "rgba(232,220,200,0.18)";
      ctx.arc(x, y, d.s, 0, Math.PI * 2);
      ctx.fill();
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
    { threshold: 0.15 },
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

  const onResize = () => surface.resize();
  window.addEventListener("resize", onResize);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    io.disconnect();
    window.removeEventListener("resize", onResize);
    stage.removeEventListener("pointermove", onMove);
    surface.destroy();
  };
}
