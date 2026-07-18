import { describe, expect, it } from "vitest";
import { actualBillableMinutes, companionServiceTotal, normalizeCompanionDuration } from "./companionBilling";

describe("companion service duration and billing", () => {
  it("enforces one hour minimum and 30-minute booking increments", () => {
    expect(normalizeCompanionDuration(20)).toBe(60);
    expect(normalizeCompanionDuration(89)).toBe(90);
    expect(normalizeCompanionDuration(121)).toBe(120);
  });

  it("prices a 1.5-hour booking and a 30-minute extension exactly", () => {
    expect(companionServiceTotal(18_000, 90)).toBe(27_000);
    expect(companionServiceTotal(18_000, 120)).toBe(36_000);
  });

  it("bills final actual time by the minute with a one-hour minimum", () => {
    expect(actualBillableMinutes(8 * 60)).toBe(60);
    expect(actualBillableMinutes(90 * 60 + 1)).toBe(91);
  });
});
