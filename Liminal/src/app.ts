import { mountPage } from "./page";
import { parseHash } from "./router";

export function start(root: HTMLElement): void {
  const page = mountPage(root);
  const apply = () => {
    const route = parseHash(location.hash);
    if (route.name === "chapter") page.openChapter(route.id);
  };
  window.addEventListener("hashchange", apply);
  apply();
}
