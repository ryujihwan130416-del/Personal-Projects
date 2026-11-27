export type Ken = "in" | "out" | "left" | "right";

export type Chapter = {
  id: string;
  index: string;
  title: string;
  titleKo: string;
  still: string;
  close?: string;
  focus: string;
  ghost: string;
  ken: Ken;
  theme: "light" | "dark";
};

export type Route = { name: "home" } | { name: "chapter"; id: string };
