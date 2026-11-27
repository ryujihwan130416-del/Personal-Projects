import { chapters } from "./chapters";
import type { Route } from "./types";

const ids = new Set(chapters.map((c) => c.id));

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, "").replace(/^\//, "").split("?")[0] ?? "";
  const id = path.split("/").filter(Boolean)[0];
  if (!id) return { name: "home" };
  if (ids.has(id)) return { name: "chapter", id };
  return { name: "home" };
}

export function chapterHref(id: string): string {
  return `#/${id}`;
}

export function homeHref(): string {
  return "#/";
}
