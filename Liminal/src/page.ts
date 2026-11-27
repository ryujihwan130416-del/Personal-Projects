import { chapters, editorialStill, hangarStill, reelStill } from "./chapters";
import { clamp, lerp } from "./math";
import { crossfade, kenTransform, nearestBeat, sectionProgress } from "./progress";
import { chapterHref } from "./router";
import { consumeLeave } from "./session";

export function mountPage(root: HTMLElement): () => void {
  root.innerHTML = markup();
  const resume = consumeLeave();
  document.body.classList.add("is-gated");

  const gate = must(root, ".gate");
  const menu = must(root, ".menu");
  const tour = must(root, ".tour");
  const reel = must(root, ".reel");
  const pin = must(root, ".tour-pin");
  const stills = [...root.querySelectorAll<HTMLElement>(".tour-still")];
  const ticks = [...root.querySelectorAll<HTMLElement>(".tour-ticks li")];
  const indexEl = must(root, ".tour-index");
  const titleEl = must(root, ".tour-title");
  const koEl = must(root, ".tour-ko");
  const menuPreview = [...root.querySelectorAll<HTMLElement>(".menu-still")];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  let beat = 0;
  let gated = !reduce.matches;
  let menuOpen = false;
  let raf = 0;
  let destroyed = false;

  const unlock = () => {
    if (!gated) return;
    gated = false;
    gate.classList.add("is-gone");
    document.body.classList.remove("is-gated");
    window.setTimeout(() => gate.remove(), 900);
  };

  const setMenu = (open: boolean) => {
    menuOpen = open;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    document.body.classList.toggle("is-menu", open);
    const btn = root.querySelector("[data-act='menu']");
    btn?.setAttribute("aria-expanded", String(open));
  };

  const showBeat = (next: number) => {
    if (next === beat) return;
    beat = next;
    const chapter = chapters[beat];
    indexEl.textContent = chapter.index;
    titleEl.textContent = chapter.title;
    koEl.textContent = chapter.titleKo;
    pin.dataset.theme = chapter.theme;
    ticks.forEach((tick, i) => tick.classList.toggle("is-on", i === beat));
    menuPreview.forEach((node, i) => node.classList.toggle("is-on", i === beat));
    const items = root.querySelectorAll(".menu-list a");
    items.forEach((item, i) => item.classList.toggle("is-on", i === beat));
    root.querySelectorAll<HTMLElement>(".tour-hit, .tour-enter").forEach((node) => {
      node.dataset.id = chapter.id;
    });
  };

  const paint = () => {
    if (destroyed) return;
    const vh = window.innerHeight;
    const tourT = sectionProgress(tour.getBoundingClientRect().top, tour.offsetHeight, vh);
    const reelT = sectionProgress(reel.getBoundingClientRect().top, reel.offsetHeight, vh);

    stills.forEach((node, i) => {
      const alpha = crossfade(tourT, i, chapters.length);
      const x = tourT * Math.max(chapters.length - 1, 1);
      const local = clamp(x - i, 0, 1);
      const ken = kenTransform(local, chapters[i].ken, reduce.matches);
      node.style.opacity = String(alpha);
      node.style.transform = `translate3d(${ken.x}%, ${ken.y}%, 0) scale(${ken.scale})`;
    });
    showBeat(nearestBeat(tourT, chapters.length));

    const reelImg = reel.querySelector<HTMLElement>(".reel-still");
    if (reelImg) {
      const zoom = reduce.matches ? 1.08 : lerp(1.2, 1.04, reelT);
      const shift = reduce.matches ? 0 : lerp(-2, 3, reelT);
      reelImg.style.transform = `translate3d(${shift}%, 0, 0) scale(${zoom})`;
    }

    raf = requestAnimationFrame(paint);
  };

  const openChapter = (id: string) => {
    unlock();
    setMenu(false);
    const i = chapters.findIndex((c) => c.id === id);
    const target =
      i < 0
        ? document.getElementById("hangar")
        : tour;
    if (i < 0) {
      target?.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" });
      return;
    }
    const travel = Math.max(1, tour.offsetHeight - window.innerHeight);
    const y = tour.getBoundingClientRect().top + window.scrollY + (i / chapters.length) * travel + 8;
    window.scrollTo({ top: y, behavior: reduce.matches ? "auto" : "smooth" });
  };

  const onClick = (event: MouseEvent) => {
    const hit = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-act]");
    if (!hit) {
      if (gated) unlock();
      return;
    }
    if (hit.tagName === "A") event.preventDefault();
    const act = hit.dataset.act;
    if (act === "enter") unlock();
    if (act === "menu") setMenu(!menuOpen);
    if (act === "close") setMenu(false);
    if (act === "enter-room") {
      const id = hit.dataset.id ?? chapters[beat].id;
      location.hash = chapterHref(id);
      return;
    }
    if (act === "to") {
      const id = hit.dataset.id ?? "";
      if (id === "hangar" || id === "reel" || id === "edit") {
        unlock();
        setMenu(false);
        document.getElementById(id)?.scrollIntoView({
          behavior: reduce.matches ? "auto" : "smooth",
        });
        return;
      }
      if (id) openChapter(id);
    }
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }
    if (event.key === "Escape") {
      if (menuOpen) setMenu(false);
      return;
    }
    if (gated && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      unlock();
      return;
    }
    const n = Number(event.key);
    if (n >= 1 && n <= chapters.length) {
      location.hash = chapterHref(chapters[n - 1].id);
    }
  };

  root.querySelector(".menu-list")?.addEventListener("pointerover", (event) => {
    const link = (event.target as HTMLElement | null)?.closest("a");
    const id = link?.dataset.id;
    if (!id) return;
    const i = chapters.findIndex((c) => c.id === id);
    if (i < 0) return;
    menuPreview.forEach((node, j) => node.classList.toggle("is-on", j === i));
  });

  root.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey);
  history.scrollRestoration = "manual";
  pin.dataset.theme = chapters[0].theme;
  showBeat(0);
  raf = requestAnimationFrame(paint);
  preload();

  if (reduce.matches || resume.skipGate) unlock();
  if (resume.landOn) {
    requestAnimationFrame(() => openChapter(resume.landOn as string));
  }

  const destroy = () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    root.removeEventListener("click", onClick);
    window.removeEventListener("keydown", onKey);
    document.body.classList.remove("is-gated", "is-menu");
  };

  window.addEventListener("pagehide", destroy);

  return destroy;
}

function markup(): string {
  const stillMarkup = chapters
    .map(
      (c, i) => `
        <figure class="tour-still" data-id="${c.id}" style="opacity:${i === 0 ? 1 : 0}">
          <img src="${c.still}" alt="" draggable="false" />
        </figure>`,
    )
    .join("");

  const ticks = chapters
    .map((c, i) => `<li class="${i === 0 ? "is-on" : ""}"><span>${c.index}</span></li>`)
    .join("");

  const menuItems = chapters
    .map(
      (c, i) => `
        <a href="${chapterHref(c.id)}" data-act="enter-room" data-id="${c.id}" class="${i === 0 ? "is-on" : ""}">
          <span>${c.index}</span>
          <b>${c.title}</b>
          <i>${c.titleKo}</i>
        </a>`,
    )
    .join("");

  const menuStills = chapters
    .map(
      (c, i) => `
        <figure class="menu-still ${i === 0 ? "is-on" : ""}">
          <img src="${c.still}" alt="" />
        </figure>`,
    )
    .join("");

  return `
    <div class="page">
      <button class="gate" data-act="enter" type="button">
        <span class="gate-kicker">Liminal Studio</span>
        <span class="gate-enter">Enter</span>
        <span class="gate-hint">스크롤하다가, 방에 들어간다</span>
      </button>

      <nav class="dock" aria-label="Liminal">
        <button type="button" data-act="to" data-id="hangar">Liminal</button>
        <i class="dock-dot" aria-hidden="true"></i>
        <button type="button" data-act="to" data-id="tour">Six rooms</button>
        <i class="dock-dot" aria-hidden="true"></i>
        <button type="button" data-act="menu" aria-expanded="false" aria-label="Menu">
          <span></span><span></span>
        </button>
      </nav>

      <aside class="menu" aria-hidden="true">
        <div class="menu-left">
          <p class="eyebrow">Index</p>
          <div class="menu-list">${menuItems}</div>
          <button type="button" class="menu-close" data-act="close">Close</button>
        </div>
        <div class="menu-right">${menuStills}</div>
      </aside>

      <section class="hangar" id="hangar">
        <div class="hangar-still">
          <img src="${hangarStill}" alt="" />
        </div>
        <div class="hangar-copy">
          <p class="eyebrow">Studio · 2026</p>
          <h1 class="mega">LIMINAL</h1>
          <p class="hangar-sub">Six rooms. One scroll.</p>
        </div>
      </section>

      <section class="tour" id="tour">
        <div class="tour-pin">
          <div class="tour-stage">${stillMarkup}</div>
          <button class="tour-hit" type="button" data-act="enter-room" data-id="origin" aria-label="들어가기"></button>
          <div class="tour-copy">
            <p class="tour-index">01</p>
            <h2 class="tour-title">Origin of Light</h2>
            <p class="tour-ko">빛의 기원</p>
            <button class="tour-enter" type="button" data-act="enter-room" data-id="origin">들어가기</button>
          </div>
          <ol class="tour-ticks">${ticks}</ol>
        </div>
      </section>

      <section class="reel" id="reel">
        <div class="reel-pin">
          <div class="reel-still">
            <img src="${reelStill}" alt="" />
          </div>
          <h2 class="mega mega-light">STILL</h2>
          <p class="reel-cap">Desert as a held frame.</p>
        </div>
      </section>

      <section class="edit" id="edit">
        <p class="ghost">LIMINAL</p>
        <p class="eyebrow">Spec</p>
        <div class="stats">
          <article>
            <b>06</b>
            <span>Rooms</span>
          </article>
          <article>
            <b>01</b>
            <span>Scroll</span>
          </article>
          <article>
            <b>∞</b>
            <span>Frames</span>
          </article>
        </div>
        <div class="split">
          <figure>
            <img src="${editorialStill}" alt="" />
          </figure>
          <figure>
            <img src="${chapters[3].still}" alt="" />
          </figure>
        </div>
      </section>

      <footer class="foot">
        <p class="mega mega-foot">LIMINAL</p>
        <p class="foot-meta">Digital art · not a product page · stills via Unsplash</p>
      </footer>
    </div>
  `;
}

function preload(): void {
  for (const src of [
    ...chapters.map((c) => c.still),
    hangarStill,
    reelStill,
    editorialStill,
  ]) {
    const img = new Image();
    img.src = src;
  }
}

function must<T extends HTMLElement>(root: ParentNode, sel: string): T {
  const node = root.querySelector<T>(sel);
  if (!node) throw new Error(`missing ${sel}`);
  return node;
}
