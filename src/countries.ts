import generatedCountries from "./countries.generated.json";

export interface CountryOption {
  code: string;
  flag: string;
  nativeName: string;
  englishName: string;
  koreanName: string;
}

export const countryOptions = generatedCountries as CountryOption[];

export function findCountry(value: string | undefined) {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return undefined;
  return countryOptions.find((country) =>
    country.code.toLocaleLowerCase() === normalized
    || country.nativeName.toLocaleLowerCase() === normalized
    || country.englishName.toLocaleLowerCase() === normalized
    || country.koreanName.toLocaleLowerCase() === normalized
  );
}

export function countryNativeName(value: string | undefined) {
  return findCountry(value)?.nativeName || value || "";
}

export function countryKoreanName(value: string | undefined) {
  return findCountry(value)?.koreanName || value || "";
}
