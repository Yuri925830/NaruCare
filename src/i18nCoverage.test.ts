import { describe, expect, it } from "vitest";
import generatedLocales from "./locales.generated.json";
import { en, localeOptions, reviewedKoreanMessages } from "./i18n";

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

  it("keeps the effective Korean copy free of machine-translated UI terms", () => {
    const korean = { ...generated.ko, ...reviewedKoreanMessages } as Record<string, string>;
    const awkwardTerms = [
      /귀하/u,
      /당신/u,
      /인간 동반자/u,
      /최고의 일치/u,
      /방문 여행/u,
      /번역 방문/u,
      /리셉션/u,
      /유닛/u,
      /테스트 결과/u,
      /노선상태/u,
      /음성 스크립트/u,
      /동료/u,
      /컴패니언/u,
      /의료 카드/u,
      /방문 흐름/u,
      /번역 대화/u,
      /녹화/u,
      /수수료/u,
      /예금/u,
      /은행 카드/u,
      /주문/u,
      /비상 모드/u,
      /급여 잔액/u,
      /수출기록/u,
      /계속 주문/u,
      /나루가 말한다/u,
    ];
    const findings = Object.entries(korean).flatMap(([key, value]) =>
      awkwardTerms.filter((term) => term.test(value)).map((term) => `${key}: ${term.source}`),
    );
    expect(findings).toEqual([]);
  });
});
