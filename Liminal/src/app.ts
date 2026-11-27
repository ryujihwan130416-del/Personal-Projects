import { findChapter } from "./chapters";
import { mountInterior } from "./interior";
import { mountPage } from "./page";
import { parseHash } from "./router";

export function start(root: HTMLElement): void {
  let unmount: () => void = () => undefined;

  const render = () => {
    unmount();
    document.body.classList.remove("is-gated", "is-menu", "is-inside");
    const route = parseHash(location.hash);
    if (route.name === "chapter" && findChapter(route.id)) {
      window.scrollTo(0, 0);
      unmount = mountInterior(root, route.id);
      return;
    }
    window.scrollTo(0, 0);
    unmount = mountPage(root);
  };

  window.addEventListener("hashchange", render);
  render();
}
