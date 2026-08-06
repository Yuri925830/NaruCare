import { describe, expect, it } from "vitest";
import {
  MEDICAL_CARD_CHAT_STEPS,
  applyMedicalCardChatAnswer,
  createMedicalCardChatDraft,
  isMedicalCardCancelAnswer,
  maskMedicalCardChatValue,
  medicalCardConversationCopy,
  parseMedicalCardChatAnswer,
} from "./medicalCardConversation";

describe("medical card chat conversation", () => {
  it("creates a complete empty card draft", () => {
    const draft = createMedicalCardChatDraft("ko");
    expect(draft.language).toBe("ko");
    expect(draft.name).toBe("");
    expect(MEDICAL_CARD_CHAT_STEPS).toHaveLength(14);
  });

  it("validates age and required fields", () => {
    const age = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "age")!;
    const name = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "name")!;
    expect(parseMedicalCardChatAnswer(age, "34")).toEqual({ ok: true, value: "34" });
    expect(parseMedicalCardChatAnswer(age, "121")).toEqual({ ok: false, error: "invalidAge" });
    expect(parseMedicalCardChatAnswer(name, "건너뛰기")).toEqual({ ok: false, error: "required" });
  });

  it("normalizes Korean structured answers", () => {
    const gender = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "gender")!;
    const document = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "documentType")!;
    const insurance = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "insurance")!;
    expect(parseMedicalCardChatAnswer(gender, "여성")).toEqual({ ok: true, value: "female" });
    expect(parseMedicalCardChatAnswer(document, "여권")).toEqual({ ok: true, value: "passport" });
    expect(parseMedicalCardChatAnswer(insurance, "네")).toEqual({ ok: true, value: "yes" });
    expect(parseMedicalCardChatAnswer(insurance, "없음")).toEqual({ ok: true, value: "no" });
  });

  it("allows optional fields to be skipped and masks document numbers", () => {
    const notes = MEDICAL_CARD_CHAT_STEPS.find((step) => step.key === "notes")!;
    const draft = createMedicalCardChatDraft("en");
    expect(parseMedicalCardChatAnswer(notes, "skip")).toEqual({ ok: true, value: "" });
    expect(applyMedicalCardChatAnswer(draft, "notes", "Needs wheelchair").notes).toBe("Needs wheelchair");
    expect(maskMedicalCardChatValue("documentNumber", "M123456789")).toBe("******6789");
  });

  it("supports cancellation and reviewed Korean copy", () => {
    expect(isMedicalCardCancelAnswer("작성 취소")).toBe(true);
    expect(isMedicalCardCancelAnswer("취소")).toBe(true);
    expect(medicalCardConversationCopy("ko").save).toBe("진료카드 저장");
    expect(medicalCardConversationCopy("ja")).toEqual(medicalCardConversationCopy("en"));
  });
});
