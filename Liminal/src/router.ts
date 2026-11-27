import type { Route } from "./types";
import { works } from "./works/index";

const ids = new Set(works.map((w) => w.id));

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\//, "").split("?")[0] ?? "";
  const id = path.split("/").filter(Boolean)[0];
  if (!id) return { name: "gallery" };
  if (ids.has(id)) return { name: "work", id };
  return { name: "gallery" };
}

export function workHref(id: string): string {
  return `#/${id}`;
}

export function galleryHref(): string {
  return "#/";
}
