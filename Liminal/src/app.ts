import { mountExperience } from "./experience";
import { mountGallery } from "./gallery";
import { parseHash, workHref } from "./router";
import { works } from "./works/index";

export function start(root: HTMLElement): void {
  let unmount: () => void = () => undefined;

  const render = () => {
    unmount();
    window.scrollTo(0, 0);
    const route = parseHash(location.hash);
    if (route.name === "work") {
      unmount = mountExperience(root, route.id);
      return;
    }
    unmount = mountGallery(root);
  };

  window.addEventListener("hashchange", render);
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const n = Number(e.key);
    if (n >= 1 && n <= works.length) {
      location.hash = workHref(works[n - 1].id);
    }
  });

  render();
}
