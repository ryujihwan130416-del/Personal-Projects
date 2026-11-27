import { describe, expect, it } from "vitest";
import { chapters, findChapter } from "./chapters";
import { clamp, inverseLerp, lerp, ridge, smoothstep } from "./math";
import { crossfade, kenTransform, nearestBeat, sectionProgress } from "./progress";
import { parseHash } from "./router";

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
    expect(chapters).toHaveLength(6);
    const ids = chapters.map((c) => c.id);
    expect(new Set(ids).size).toBe(6);
    expect(chapters.every((c) => c.title.length > 0 && c.still.startsWith("/stills/"))).toBe(
      true,
    );
    expect(findChapter("weather")?.titleKo).toContain("날씨");
  });
});

describe("router", () => {
  it("parses home and chapter hashes", () => {
    expect(parseHash("")).toEqual({ name: "home" });
    expect(parseHash("#/")).toEqual({ name: "home" });
    expect(parseHash("#/origin")).toEqual({ name: "chapter", id: "origin" });
    expect(parseHash("#/missing")).toEqual({ name: "home" });
  });
});

describe("progress", () => {
  it("maps a sticky section onto 0..1", () => {
    expect(sectionProgress(0, 1000, 200)).toBe(0);
    expect(sectionProgress(-400, 1000, 200)).toBe(0.5);
    expect(sectionProgress(-800, 1000, 200)).toBe(1);
    expect(sectionProgress(40, 1000, 200)).toBe(0);
  });

  it("crossfades neighboring stills", () => {
    expect(crossfade(0, 0, 6)).toBe(1);
    expect(crossfade(0, 1, 6)).toBe(0);
    expect(crossfade(0.2, 1, 6)).toBeCloseTo(1);
    expect(nearestBeat(0, 6)).toBe(0);
    expect(nearestBeat(1, 6)).toBe(5);
  });

  it("holds ken burns still when motion is reduced", () => {
    expect(kenTransform(0.4, "in", true).scale).toBeCloseTo(1.06);
    expect(kenTransform(1, "in", false).scale).toBeLessThan(kenTransform(0, "in", false).scale);
  });
});
