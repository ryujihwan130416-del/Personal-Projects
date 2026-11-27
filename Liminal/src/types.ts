export type Frame = {
  t: number;
  time: number;
  dt: number;
  w: number;
  h: number;
  pointerX: number;
  pointerY: number;
  pointer: boolean;
  quality: "full" | "preview";
  reduceMotion: boolean;
};

export type WorkRenderer = {
  draw: (ctx: CanvasRenderingContext2D, frame: Frame) => void;
};

export type Work = {
  id: string;
  index: string;
  title: string;
  titleKo: string;
  tone: string;
  durationVh: number;
  previewT: (time: number) => number;
  create: () => WorkRenderer;
};

export type Route = { name: "gallery" } | { name: "work"; id: string };
