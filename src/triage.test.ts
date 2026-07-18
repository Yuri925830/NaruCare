import { describe, expect, it } from "vitest";
import { assessMedicalIntent, hasMedicalSymptoms } from "./triage";

describe("medical triage", () => {
  it.each([
    "就发高烧，看不见东西",
    "我现在无法呼吸，很痛苦",
    "I cannot breathe and have severe chest pain",
    "No puedo respirar",
    "숨을 쉴 수 없고 가슴이 너무 아파요",
    "息ができなくて、激しい胸痛があります",
    "我已经割腕大出血，我想自杀",
  ])("routes red flags to emergency: %s", (message) => {
    expect(assessMedicalIntent(message).intent).toBe("emergency");
  });

  it("uses previous symptoms when the user asks for a hospital in the next turn", () => {
    const result = assessMedicalIntent("那你帮我找医院啊", ["就发高烧，看不见东西"]);
    expect(result.intent).toBe("emergency");
    expect(result.symptoms).toContain("高烧");
  });

  it.each([
    "肚子疼，一直拉肚子还吐了，今天吃了海鲜",
    "I have a fever and cough",
    "열이 나고 기침이 나요",
    "Tengo fiebre y tos",
    "J'ai de la fièvre et je tousse",
    "Tôi bị sốt và ho",
  ])("routes non-red-flag symptoms to hospitals: %s", (message) => {
    expect(assessMedicalIntent(message).intent).toBe("hospital");
  });

  it("honors an explicit hospital request and carries prior symptom context", () => {
    const result = assessMedicalIntent("帮我找附近医院", ["昨天开始咳嗽发烧"]);
    expect(result.intent).toBe("hospital");
    expect(result.symptoms).toBe("昨天开始咳嗽发烧");
  });

  it("does not turn an explicitly negated chest pain statement into an emergency", () => {
    expect(assessMedicalIntent("我没有胸痛，只是想了解韩国医院怎么预约").intent).not.toBe("emergency");
  });

  it("keeps ordinary conversation general", () => {
    expect(assessMedicalIntent("谢谢你，Naru").intent).toBe("general");
    expect(hasMedicalSymptoms("谢谢你，Naru")).toBe(false);
  });

  it.each([
    ["How do I prepare documents for a Korean hospital?", "flow"],
    ["告诉我去韩国医院的就诊流程", "flow"],
    ["帮我打开翻译对话", "translation"],
    ["我需要一名真人陪诊师", "companion"],
    ["我要修改就诊卡", "card"],
  ])("routes service request '%s' to %s", (message, intent) => {
    expect(assessMedicalIntent(message).intent).toBe(intent);
  });
});
