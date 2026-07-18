import { describe, expect, it } from "vitest";
import { evaluateOpeningHours } from "./hospitalHours";

describe("evaluateOpeningHours", () => {
  it("keeps a 24/7 emergency department open with no rest day", () => {
    expect(evaluateOpeningHours("24/7", new Date("2026-07-18T12:00:00Z"))).toEqual({ isOpen: true, restDayIndexes: [] });
  });

  it("evaluates Seoul weekday hours and derives weekend closure", () => {
    const weekday = evaluateOpeningHours("Mo-Fr 09:00-17:00", new Date("2026-07-16T03:00:00Z"));
    expect(weekday.isOpen).toBe(true);
    expect(weekday.restDayIndexes).toEqual([0, 6]);
  });

  it("marks the same outpatient schedule closed on Saturday", () => {
    expect(evaluateOpeningHours("Mo-Fr 09:00-17:00", new Date("2026-07-18T03:00:00Z")).isOpen).toBe(false);
  });

  it("keeps an overnight Friday service open after midnight on Saturday", () => {
    expect(evaluateOpeningHours("Fr 22:00-02:00", new Date("2026-07-17T16:00:00Z")).isOpen).toBe(true);
  });

  it("does not invent a status when the source has no hours", () => {
    expect(evaluateOpeningHours(undefined).isOpen).toBeNull();
  });
});
