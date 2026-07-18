import { describe, expect, it } from "vitest";
import { countryKoreanName, countryOptions, findCountry } from "./countries";

describe("country catalogue", () => {
  it("contains a complete unique native-language dropdown catalogue", () => {
    expect(countryOptions.length).toBeGreaterThanOrEqual(240);
    expect(new Set(countryOptions.map((country) => country.code)).size).toBe(countryOptions.length);
    expect(countryOptions.every((country) => country.nativeName && country.koreanName && country.flag)).toBe(true);
  });

  it("resolves native and Korean names from the stored country code", () => {
    expect(findCountry("CN")?.nativeName).toBe("中国");
    expect(countryKoreanName("CN")).toBe("중국");
  });
});
