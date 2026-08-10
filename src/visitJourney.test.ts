import { describe, expect, it } from "vitest";
import {
  companionDecisionFromText,
  furthestVisitJourneyStep,
  isJourneyChatActionAllowed,
  journeyChatActionRequiresHighConfidence,
  isVisitJourneyStepUnlocked,
  journeyChatActionFromText,
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

  it("maps chat commands to actions for the current journey step", () => {
    expect(journeyChatActionFromText("symptoms", "다음")).toBe("explain_current_step");
    expect(journeyChatActionFromText("hospital", "가까운 병원 찾아줘")).toBe("open_current_step");
    expect(journeyChatActionFromText("appointment", "다음 단계")).toBe("explain_current_step");
    expect(journeyChatActionFromText("prepare", "준비물 확인하러 갈게")).toBe("open_current_step");
    expect(journeyChatActionFromText("navigation", "길 안내 시작해줘")).toBe("open_current_step");
    expect(journeyChatActionFromText("navigation", "병원에 도착했어")).toBe("confirm_arrival");
    expect(journeyChatActionFromText("translation", "통역 시작해줘")).toBe("open_current_step");
    expect(journeyChatActionFromText("translation", "진료 끝났어")).toBe("complete_visit");
  });

  it("does not let a vague next command skip required decisions", () => {
    expect(journeyChatActionFromText("appointment", "계속 진행")).toBe("explain_current_step");
    expect(journeyChatActionFromText("companion", "next")).toBe("explain_current_step");
    expect(journeyChatActionFromText("appointment", "다른 병원으로 바꿔줘")).toBe("change_hospital");
    expect(journeyChatActionFromText("complete", "다음")).toBeNull();
  });

  it("allows model actions only at their matching state-machine step", () => {
    expect(isJourneyChatActionAllowed("appointment", "skip_appointment")).toBe(true);
    expect(isJourneyChatActionAllowed("hospital", "skip_appointment")).toBe(false);
    expect(isJourneyChatActionAllowed("companion", "use_companion")).toBe(true);
    expect(isJourneyChatActionAllowed("prepare", "use_companion")).toBe(false);
    expect(isJourneyChatActionAllowed("navigation", "confirm_arrival")).toBe(true);
    expect(isJourneyChatActionAllowed("prepare", "confirm_arrival")).toBe(false);
    expect(isJourneyChatActionAllowed("translation", "complete_visit")).toBe(true);
    expect(isJourneyChatActionAllowed("navigation", "complete_visit")).toBe(false);
  });

  it("requires high confidence before model actions can change visit state", () => {
    expect(journeyChatActionRequiresHighConfidence("confirm_arrival")).toBe(true);
    expect(journeyChatActionRequiresHighConfidence("skip_companion")).toBe(true);
    expect(journeyChatActionRequiresHighConfidence("open_current_step")).toBe(false);
    expect(journeyChatActionRequiresHighConfidence("explain_current_step")).toBe(false);
  });
});
