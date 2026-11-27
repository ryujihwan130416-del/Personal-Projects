export type Caption = {
  at: number;
  kicker: string;
  line: string;
  lineKo: string;
};

export type Frame = {
  /** Scroll progress 0–1. */
  t: number;
  /** Elapsed seconds since the renderer was created. */
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
  resize?: (w: number, h: number) => void;
};

export type Work = {
  id: string;
  index: string;
  title: string;
  titleKo: string;
  line: string;
  tone: string;
  durationVh: number;
  captions: Caption[];
  previewT: (time: number) => number;
  create: () => WorkRenderer;
};

export type Route = { name: "gallery" } | { name: "work"; id: string };
