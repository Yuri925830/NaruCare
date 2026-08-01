import { describe, expect, it } from "vitest";
import {
  companionDecisionFromText,
  furthestVisitJourneyStep,
  isVisitJourneyStepUnlocked,
  visitJourneyStepIndex,
  visitJourneySteps,
} from "./visitJourney";

describe("visit journey", () => {
  it("keeps the hospital visit steps in workflow order", () => {
    expect(visitJourneySteps).toEqual([
      "symptoms",
      "hospital",
      "appointment",
      "companion",
      "prepare",
      "navigation",
      "translation",
      "complete",
    ]);
    expect(visitJourneyStepIndex("navigation")).toBe(5);
  });

  it("never moves progress backward", () => {
    expect(furthestVisitJourneyStep("prepare", "hospital")).toBe("prepare");
    expect(furthestVisitJourneyStep("prepare", "translation")).toBe("translation");
  });

  it("unlocks only the current and completed steps", () => {
    expect(isVisitJourneyStepUnlocked("prepare", "symptoms")).toBe(true);
    expect(isVisitJourneyStepUnlocked("prepare", "prepare")).toBe(true);
    expect(isVisitJourneyStepUnlocked("prepare", "navigation")).toBe(false);
  });

  it("recognizes typed companion branch choices", () => {
    expect(companionDecisionFromText("동행인 추천해줘")).toBe("use");
    expect(companionDecisionFromText("이번에는 혼자 갈게요")).toBe("skip");
    expect(companionDecisionFromText("I need a companion")).toBe("use");
    expect(companionDecisionFromText("without a companion")).toBe("skip");
    expect(companionDecisionFromText("병원 준비물을 알려줘")).toBeNull();
  });
});
