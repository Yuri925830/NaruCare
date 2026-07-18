import { describe, expect, it } from "vitest";
import manifest from "../public/naru/manifest.json";

const modules = import.meta.glob("./**/*.tsx", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

describe("Naru pose placement", () => {
  const source = Object.values(modules).join("\n");

  it("uses every one of the 21 independent pose assets", () => {
    const used = new Set<number>();
    for (const match of source.matchAll(/<NaruPose\b[^>]*\bpose=\{([^}]*)\}/g)) {
      for (const number of match[1].matchAll(/\b(?:[1-9]|1[0-9]|2[01])\b/g)) used.add(Number(number[0]));
    }
    expect([...used].sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, index) => index + 1));
    expect(manifest.map((item) => item.file)).toEqual(Array.from({ length: 21 }, (_, index) => `pose-${String(index + 1).padStart(2, "0")}.png`));
    expect(manifest.every((item) => item.transparentCorners)).toBe(true);
  });

  it("does not render the old combined or gallery assets", () => {
    expect(source).not.toMatch(/NaruImage|NaruCollection|NaruPoseDuo|naru\.png/);
  });
});
