import type { Work } from "../types";
import { bloom } from "./bloom";
import { city } from "./city";
import { origin } from "./origin";
import { room } from "./room";
import { symphony } from "./symphony";
import { weather } from "./weather";

export const works: Work[] = [origin, weather, bloom, room, symphony, city];

export function findWork(id: string): Work | undefined {
  return works.find((w) => w.id === id);
}
