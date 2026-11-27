import { describe, expect, it } from "vitest";
import { clamp, inverseLerp, lerp, ridge, smoothstep } from "./math";
import { parseHash } from "./router";
import { findWork, works } from "./works/index";

describe("math", () => {
  it("clamps and lerps", () => {
    expect(clamp(3, 0, 1)).toBe(1);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(inverseLerp(10, 20, 15)).toBe(0.5);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });

  it("builds a ridge that peaks in the middle", () => {
    expect(ridge(0.2, 0, 0.2, 0.4)).toBeCloseTo(1);
    expect(ridge(0, 0, 0.2, 0.4)).toBeCloseTo(0);
    expect(ridge(0.4, 0, 0.2, 0.4)).toBeCloseTo(0);
  });
});

describe("catalog", () => {
  it("has six unique rooms", () => {
    expect(works).toHaveLength(6);
    const ids = works.map((w) => w.id);
    expect(new Set(ids).size).toBe(6);
    expect(works.every((w) => w.captions.length >= 4)).toBe(true);
    expect(findWork("weather")?.titleKo).toContain("날씨");
  });
});

describe("router", () => {
  it("parses gallery and work hashes", () => {
    expect(parseHash("")).toEqual({ name: "gallery" });
    expect(parseHash("#/")).toEqual({ name: "gallery" });
    expect(parseHash("#/origin")).toEqual({ name: "work", id: "origin" });
    expect(parseHash("#/missing")).toEqual({ name: "gallery" });
  });
});
