import { describe, expect, it } from "vitest";
import { localeOptions } from "./i18n";
import { medicalDocumentCopy } from "./medicalDocumentCopy";
import { documentConversationCopy } from "./documentConversationCopy";
import { documentFeatureLocales, resolveDocumentLocale } from "./documentLocales";

const variables = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();

describe("complete document feature localization", () => {
  it("covers exactly every language enabled in the app, so new locales cannot silently fall back", () => {
    expect([...documentFeatureLocales].sort()).toEqual(localeOptions.map(({ code }) => code).sort());
  });

  it.each(localeOptions.map(({ code }) => code))("provides all upload, translation and Naru copy in %s", (locale) => {
    const englishMedical = medicalDocumentCopy("en");
    const englishChat = documentConversationCopy("en");
    const medical = medicalDocumentCopy(locale);
    const chat = documentConversationCopy(locale);
    expect(Object.keys(medical).sort()).toEqual(Object.keys(englishMedical).sort());
    expect(Object.keys(chat).sort()).toEqual(Object.keys(englishChat).sort());
    for (const [key, value] of Object.entries(medical)) {
      expect(typeof value, `${locale}.medical.${key}`).toBe("string");
      expect(value.trim(), `${locale}.medical.${key}`).toBeTruthy();
      expect(variables(value), `${locale}.medical.${key}`).toEqual(variables(englishMedical[key as keyof typeof englishMedical]));
      expect(value).not.toMatch(/\uFFFD|\[\[\[|TODO|TRANSLATE_ME/);
    }
    for (const [key, value] of Object.entries(chat)) {
      const original = englishChat[key as keyof typeof englishChat];
      expect(Array.isArray(value)).toBe(Array.isArray(original));
      const items = Array.isArray(value) ? value : [value];
      const sourceItems = Array.isArray(original) ? original : [original];
      expect(items).toHaveLength(sourceItems.length);
      items.forEach((item, index) => {
        expect(item.trim(), `${locale}.conversation.${key}[${index}]`).toBeTruthy();
        expect(variables(item)).toEqual(variables(sourceItems[index]));
        expect(item).not.toMatch(/\uFFFD|\[\[\[|TODO|TRANSLATE_ME/);
      });
    }
    if (locale !== "en") {
      expect(medical).not.toBe(englishMedical);
      expect(chat).not.toBe(englishChat);
      for (const key of ["subtitle", "reviewHelp", "pdfHelp", "demoHelp", "processingError", "translationError", "clinicalNote"] as const) {
        expect(medical[key], `${locale}.medical.${key} remains English`).not.toBe(englishMedical[key]);
      }
      for (const key of ["welcome", "askNaruHelp", "error", "clinicalNote"] as const) {
        expect(chat[key], `${locale}.conversation.${key} remains English`).not.toBe(englishChat[key]);
      }
      chat.questions.forEach((question, index) => expect(question, `${locale}.question.${index} remains English`).not.toBe(englishChat.questions[index]));
    }
  });

  it.each([["pt-PT", "pt-BR"], ["pt_br", "pt-BR"], ["zh-Hans", "zh-CN"], ["fil-PH", "tl"], ["ar-SA", "ar"], ["ur-PK", "ur"], ["fa-IR", "fa"], ["en-US", "en"], ["de-DE", "de"]])("resolves browser language %s to %s", (input, expected) => {
    expect(resolveDocumentLocale(input)).toBe(expected);
    expect(medicalDocumentCopy(input)).toBe(medicalDocumentCopy(expected));
    expect(documentConversationCopy(input)).toBe(documentConversationCopy(expected));
  });
});
