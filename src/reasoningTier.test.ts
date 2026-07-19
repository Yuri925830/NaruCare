import { describe, expect, it } from "vitest";
import { selectReasoningTier, type ReasoningAssessment } from "./reasoningTier";

function assessment(overrides: Partial<ReasoningAssessment> = {}): ReasoningAssessment {
  return {
    intent: "general",
    confidence: "high",
    symptomStatus: "none",
    symptoms: "",
    ...overrides,
  };
}

describe("selectReasoningTier", () => {
  it.each(["你好", "谢谢", "你是谁", "hello"])("keeps simple conversation lightweight: %s", (message) => {
    expect(selectReasoningTier({ message, history: [], assessment: assessment() }).tier).toBe("light");
  });

  it("does not let a noisy model confidence score escalate an exact greeting", () => {
    expect(selectReasoningTier({
      message: "你好",
      history: [],
      assessment: assessment({ confidence: "low", symptomStatus: "unknown" }),
    }).tier).toBe("light");
  });

  it("keeps a simple medical definition lightweight", () => {
    expect(selectReasoningTier({
      message: "什么是普通感冒？",
      history: [],
      assessment: assessment({ intent: "education" }),
    }).tier).toBe("light");
  });

  it("keeps one short new mild symptom lightweight", () => {
    expect(selectReasoningTier({
      message: "我肚子有点疼",
      history: [],
      assessment: assessment({ intent: "hospital", symptomStatus: "new", symptoms: "轻微腹痛" }),
    }).tier).toBe("light");
  });

  it("escalates medication safety and interaction questions", () => {
    const decision = selectReasoningTier({
      message: "我同时在吃安眠药和抗生素，可以一起服用吗？",
      history: [],
      assessment: assessment({ intent: "education" }),
    });
    expect(decision.tier).toBe("deep");
    expect(decision.reasons).toContain("high_stakes_medical_topic");
  });

  it("escalates high-stakes medication text even if the light model misclassifies it as general", () => {
    expect(selectReasoningTier({
      message: "安眠药和抗生素一起吃会有相互作用吗？",
      history: [],
      assessment: assessment({ intent: "general" }),
    }).tier).toBe("deep");
  });

  it("escalates a multi-factor changing symptom report", () => {
    expect(selectReasoningTier({
      message: "我肚子疼三天了，吃海鲜后又吐又拉，但现在腹痛减轻了仍然发烧",
      history: [],
      assessment: assessment({ intent: "hospital", symptomStatus: "improving", symptoms: "腹泻、呕吐、发烧" }),
    }).tier).toBe("deep");
  });

  it("escalates contextual corrections but not history alone", () => {
    expect(selectReasoningTier({
      message: "但是我现在不吐了，还要继续吃那个药吗？",
      history: ["昨天开始腹痛和呕吐", "请观察症状变化"],
      assessment: assessment({ intent: "hospital", symptomStatus: "improving", symptoms: "腹痛" }),
    }).tier).toBe("deep");
    expect(selectReasoningTier({
      message: "今天天气不错",
      history: ["你好"],
      assessment: assessment(),
    }).tier).toBe("light");
  });

  it("escalates low-confidence ambiguity and inferred emergencies", () => {
    expect(selectReasoningTier({
      message: "咕噜咕噜那个蓝色又不是",
      history: [],
      assessment: assessment({ confidence: "low", symptomStatus: "unknown" }),
    }).tier).toBe("deep");
    expect(selectReasoningTier({
      message: "我突然喘不上气",
      history: [],
      assessment: assessment({ intent: "emergency", symptomStatus: "new", symptoms: "呼吸困难" }),
    }).tier).toBe("deep");
  });
});
