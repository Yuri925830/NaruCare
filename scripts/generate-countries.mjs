import { writeFile } from "node:fs/promises";
import countries from "world-countries";

const outputPath = new URL("../src/countries.generated.json", import.meta.url);
const flagFromCode = (code) => [...code].map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join("");

const output = countries
  .filter((country) => /^[A-Z]{2}$/.test(country.cca2))
  .map((country) => {
    const nativeNames = Object.values(country.name.native || {});
    const nativeName = nativeNames.find((name) => name?.common)?.common || country.name.common;
    return {
      code: country.cca2,
      flag: country.flag || flagFromCode(country.cca2),
      nativeName,
      englishName: country.name.common,
      koreanName: country.translations?.kor?.common || country.name.common,
    };
  })
  .sort((left, right) => left.nativeName.localeCompare(right.nativeName, "und"));

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
process.stdout.write(`Generated ${output.length} country and territory options.\n`);
