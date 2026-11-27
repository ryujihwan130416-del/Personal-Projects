import type { Chapter } from "./types";

export const chapters: Chapter[] = [
  {
    id: "origin",
    index: "01",
    title: "Origin of Light",
    titleKo: "빛의 기원",
    still: "/stills/aurora.jpg",
    focus: "62% 38%",
    ghost: "LIGHT",
    ken: "in",
    theme: "dark",
  },
  {
    id: "weather",
    index: "02",
    title: "Weather Inside Me",
    titleKo: "내 안의 날씨",
    still: "/stills/weather.jpg",
    close: "/stills/weather-close.jpg",
    focus: "40% 55%",
    ghost: "STORM",
    ken: "left",
    theme: "dark",
  },
  {
    id: "bloom",
    index: "03",
    title: "Digital Bloom",
    titleKo: "디지털 블룸",
    still: "/stills/bloom.jpg",
    close: "/stills/bloom-close.jpg",
    focus: "70% 45%",
    ghost: "BLOOM",
    ken: "out",
    theme: "light",
  },
  {
    id: "room",
    index: "04",
    title: "Room of Forgotten Things",
    titleKo: "잊힌 것들의 방",
    still: "/stills/room.jpg",
    close: "/stills/room-close.jpg",
    focus: "72% 40%",
    ghost: "ROOM",
    ken: "right",
    theme: "light",
  },
  {
    id: "symphony",
    index: "05",
    title: "Silent Symphony",
    titleKo: "사일런트 심포니",
    still: "/stills/symphony.jpg",
    focus: "50% 42%",
    ghost: "SOUND",
    ken: "in",
    theme: "dark",
  },
  {
    id: "city",
    index: "06",
    title: "City as Signal",
    titleKo: "시티 시그널",
    still: "/stills/city.jpg",
    close: "/stills/city-close.jpg",
    focus: "48% 60%",
    ghost: "SIGNAL",
    ken: "left",
    theme: "dark",
  },
];

export const reelStill = "/stills/film.jpg";
export const hangarStill = "/stills/hangar.jpg";
export const editorialStill = "/stills/architecture.jpg";

export function findChapter(id: string): Chapter | undefined {
  return chapters.find((c) => c.id === id);
}

export function chapterIndex(id: string): number {
  return chapters.findIndex((c) => c.id === id);
}
