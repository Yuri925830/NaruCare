import { describe, expect, it } from "vitest";
import generatedLocales from "./locales.generated.json";
import { en, localeOptions } from "./i18n";

describe("locale coverage", () => {
  const englishKeys = Object.keys(en);
  const generated = generatedLocales as Record<string, Record<string, string>>;

  it("contains a complete generated pack for every non-English/non-Chinese locale", () => {
    for (const { code } of localeOptions.filter(({ code }) => !["en", "zh-CN"].includes(code))) {
      expect(Object.keys(generated[code] || {}), code).toHaveLength(englishKeys.length);
      for (const key of englishKeys) expect(generated[code]?.[key]?.trim(), `${code}.${key}`).toBeTruthy();
    }
  });

  it("preserves interpolation variables and contains no marker fragments", () => {
    const variables = (value: string) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    const mismatches: string[] = [];
    for (const [locale, messages] of Object.entries(generated)) {
      for (const key of englishKeys) {
        const expected = variables(en[key as keyof typeof en]);
        const actual = variables(messages[key]);
        if (actual.join("|") !== expected.join("|")) mismatches.push(`${locale}.${key}: ${actual.join(",")} -> ${expected.join(",")}`);
        expect(messages[key], `${locale}.${key}`).not.toMatch(/\n\s*\[$/u);
      }
    }
    expect(mismatches).toEqual([]);
  });
});
