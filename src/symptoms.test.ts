import { describe, expect, it } from "vitest";
import { isLikelySymptomDescription } from "./symptoms";

describe("symptom description detection", () => {
  it.each(["我头晕而且发烧", "I have a rash and feel dizzy", "기침이 나고 열이 있어요", "めまいと吐き気があります"])("captures multilingual symptoms: %s", (text) => {
    expect(isLikelySymptomDescription(text)).toBe(true);
  });
  it("does not treat companion commands as symptoms", () => expect(isLikelySymptomDescription("我需要真人陪诊")).toBe(false));
});
