import { chapters, findChapter } from "./chapters";
import { createFx } from "./fx";
import { lerp } from "./math";
import { sectionProgress } from "./progress";
import { chapterHref, homeHref } from "./router";
import { markLeave } from "./session";

export function mountInterior(root: HTMLElement, id: string): () => void {
  const chapter = findChapter(id) ?? chapters[0];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.innerHTML = markup(chapter);
  document.body.classList.add("is-inside");
  window.scrollTo(0, 0);

  const shell = must(root, ".interior");
  const wide = must<HTMLElement>(root, ".interior-layer.is-wide");
  const close = must<HTMLElement>(root, ".interior-layer.is-close");
  const canvas = must<HTMLCanvasElement>(root, ".interior-fx");
  const copy = must(root, ".interior-copy");
  const ghost = must(root, ".interior-ghost");
  const ctx = canvas.getContext("2d", { alpha: true });
  const draw = createFx(chapter.id);
  let raf = 0;
  let running = true;
  let w = 1;
  let h = 1;

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  const paint = (time: number) => {
    if (!running) return;
    const t = sectionProgress(
      shell.getBoundingClientRect().top,
      shell.offsetHeight,
      window.innerHeight,
    );
    const into = reduce.matches ? Math.min(1, t * 1.2) : t;
    wide.style.opacity = String(1 - into * 0.92);
    wide.style.transform = `translate3d(${lerp(-1, 2, into)}%, ${lerp(1, -2, into)}%, 0) scale(${lerp(1.08, 1.28, into)})`;
    close.style.opacity = String(Math.max(0, into * 1.15 - 0.08));
    close.style.transform = `translate3d(${lerp(2, -1.4, into)}%, ${lerp(-1.5, 1, into)}%, 0) scale(${lerp(1.45, 1.08, into)})`;
    copy.style.opacity = String(Math.max(0, 1 - into * 1.15));
    ghost.style.opacity = String(0.12 + into * 0.28);
    ghost.style.transform = `translate(-6vw, ${lerp(18, -8, into)}%) scale(${lerp(0.86, 1.18, into)})`;
    if (ctx) draw({ ctx, w, h, t: into, time, reduce: reduce.matches });
    raf = requestAnimationFrame(paint);
  };
  raf = requestAnimationFrame(paint);

  const leave = () => {
    markLeave(chapter.id);
    location.hash = homeHref();
  };

  const onClick = (event: MouseEvent) => {
    const hit = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
    if (!hit) return;
    if (hit.tagName === "A") event.preventDefault();
    const act = hit.dataset.act;
    if (act === "leave") leave();
    if (act === "enter-room" && hit.dataset.id) {
      location.hash = chapterHref(hit.dataset.id);
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      leave();
      return;
    }
    const n = Number(event.key);
    if (n >= 1 && n <= chapters.length) {
      location.hash = chapterHref(chapters[n - 1].id);
    }
  };

  root.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    root.removeEventListener("click", onClick);
    window.removeEventListener("keydown", onKey);
    document.body.classList.remove("is-inside");
  };
}

function markup(chapter: (typeof chapters)[number]): string {
  const i = chapters.findIndex((c) => c.id === chapter.id);
  const prev = chapters[(i - 1 + chapters.length) % chapters.length];
  const next = chapters[(i + 1) % chapters.length];
  const closeSrc = chapter.close ?? chapter.still;
  return `
    <section class="interior" data-id="${chapter.id}" data-theme="${chapter.theme}">
      <div class="interior-pin">
        <div class="interior-layer is-wide">
          <img src="${chapter.still}" alt="" />
        </div>
        <div class="interior-layer is-close">
          <img src="${closeSrc}" alt="" style="object-position:${chapter.focus}" />
        </div>
        <canvas class="interior-fx" aria-hidden="true"></canvas>
        <div class="interior-grade" aria-hidden="true"></div>
        <p class="interior-ghost">${chapter.ghost}</p>
        <div class="interior-copy">
          <p class="tour-index">${chapter.index}</p>
          <h2 class="interior-title">${chapter.title}</h2>
          <p class="tour-ko">${chapter.titleKo}</p>
          <p class="interior-hint">스크롤해서 안으로</p>
        </div>
      </div>
      <nav class="dock interior-dock" aria-label="Room">
        <button type="button" data-act="leave">Studio</button>
        <i class="dock-dot" aria-hidden="true"></i>
        <button type="button" data-act="enter-room" data-id="${prev.id}">←</button>
        <button type="button" data-act="enter-room" data-id="${next.id}">→</button>
      </nav>
    </section>
  `;
}

function must<T extends HTMLElement>(root: ParentNode, sel: string): T {
  const node = root.querySelector<T>(sel);
  if (!node) throw new Error(`missing ${sel}`);
  return node;
}
