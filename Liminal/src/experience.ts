import { createSurface, prefersReducedMotion } from "./surface";
import { galleryHref } from "./router";
import { works } from "./works/index";
import type { Frame } from "./types";
import { clamp } from "./math";

export function mountExperience(root: HTMLElement, id: string): () => void {
  const work = works.find((w) => w.id === id);
  if (!work) {
    location.hash = galleryHref();
    return () => undefined;
  }

  root.innerHTML = "";
  root.className = "page experience";

  const stage = document.createElement("div");
  stage.className = "experience-stage";
  root.appendChild(stage);

  const chrome = document.createElement("header");
  chrome.className = "experience-chrome";
  chrome.innerHTML = `
    <a class="back" href="${galleryHref()}" aria-label="gallery">←</a>
    <div class="experience-meta">
      <span class="experience-title">${work.title}</span>
    </div>
    <div class="progress" aria-hidden="true"><i></i></div>
  `;
  root.appendChild(chrome);

  const hint = document.createElement("div");
  hint.className = "scroll-hint";
  hint.textContent = "scroll";
  root.appendChild(hint);

  const space = document.createElement("div");
  space.className = "scroll-space";
  space.style.height = `${work.durationVh}vh`;
  root.appendChild(space);

  const surface = createSurface(stage, "experience-canvas");
  const renderer = work.create();
  const reduce = prefersReducedMotion();
  const bar = chrome.querySelector("i");

  let raf = 0;
  let last = performance.now();
  let elapsed = 0;
  let hintHidden = false;
  const pointer = { x: surface.w * 0.5, y: surface.h * 0.5, on: false };

  const progressOf = (): number => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    return clamp(scrollY / max, 0, 1);
  };

  const tick = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += dt;
    const t = progressOf();
    if (bar instanceof HTMLElement) bar.style.transform = `scaleX(${t})`;
    if (!hintHidden && t > 0.015) {
      hint.classList.add("is-gone");
      chrome.classList.add("is-quiet");
      hintHidden = true;
    }
    const frame: Frame = {
      t,
      time: elapsed,
      dt,
      w: surface.w,
      h: surface.h,
      pointerX: pointer.x,
      pointerY: pointer.y,
      pointer: pointer.on,
      quality: "full",
      reduceMotion: reduce,
    };
    renderer.draw(surface.ctx, frame);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const onMove = (e: PointerEvent) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.on = true;
  };
  const onLeave = () => {
    pointer.on = false;
  };
  const onResize = () => surface.resize();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") location.hash = galleryHref();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", onResize);
  window.addEventListener("keydown", onKey);
  scrollTo(0, 0);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKey);
    surface.destroy();
    root.innerHTML = "";
    root.className = "page";
  };
}
