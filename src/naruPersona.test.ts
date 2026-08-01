import { describe, expect, it } from "vitest";
import { buildNaruPersonaPrompt } from "../worker/src/naruPersona";

describe("Naru persona prompt", () => {
  const prompt = buildNaruPersonaPrompt("ko");

  it("defines a concrete and honest identity", () => {
    expect(prompt).toContain("AI medical-visit companion");
    expect(prompt).toContain("Never pretend to be human");
    expect(prompt).toContain("do not diagnose");
  });

  it("uses the requested locale and a one-question conversation rhythm", () => {
    expect(prompt).toContain("locale ko");
    expect(prompt).toContain("ask exactly one highest-value question per turn");
    expect(prompt).toContain("friendly, respectful 해요체");
  });

  it("switches to direct emergency guidance", () => {
    expect(prompt).toContain("emergency number 119");
    expect(prompt).toMatch(/do not use emoji in an emergency/i);
    expect(prompt).toContain("State the action first");
  });

  it("prevents fabricated product actions", () => {
    expect(prompt).toContain("Never claim that you called, booked, saved, translated, or verified");
  });

  it("requires an explicit current request before opening a service", () => {
    expect(prompt).toContain("only when the latest user message explicitly requests that service");
    expect(prompt).toContain("general anxiety");
    expect(prompt).toContain("first Korean hospital visit");
  });

  it("distinguishes visit anxiety from a medical symptom", () => {
    expect(prompt).toContain("situational worry about an unfamiliar hospital visit");
    expect(prompt).toContain("do not trigger symptom assessment or hospital search");
    expect(prompt).toContain("접수, 진료, 언어 문제 중 무엇이 가장 걱정되나요?");
  });
});
