import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../src/i18n.tsx", import.meta.url);
const outputPath = new URL("../src/locales.generated.json", import.meta.url);
const sourceText = await readFile(sourcePath, "utf8");
const messages = {};
const englishBlock = sourceText.slice(sourceText.indexOf("export const en = {"), sourceText.indexOf("\n};", sourceText.indexOf("export const en = {")));
for (const line of englishBlock.split(/\r?\n/)) {
  const match = line.match(/^\s{2}([A-Za-z][A-Za-z0-9]*):\s*("(?:\\.|[^"\\])*")\s*,?$/);
  if (match) messages[match[1]] = JSON.parse(match[2]);
}

if (Object.keys(messages).length < 100) throw new Error(`Only found ${Object.keys(messages).length} source messages`);

const allTargets = ["ko", "ja", "es", "fr", "de", "pt-BR", "ru", "ar", "hi", "id", "vi", "th", "tr", "it", "nl", "pl", "uk", "ms", "tl", "mn", "uz", "bn", "ur", "fa", "ne", "my"];
const force = process.argv.includes("--force");
const requestedTargets = process.argv.slice(2).filter((argument) => argument !== "--force");
const targets = requestedTargets.length ? requestedTargets : allTargets;
for (const language of targets) if (!allTargets.includes(language)) throw new Error(`Unsupported locale: ${language}`);
const googleCodes = { "pt-BR": "pt", tl: "tl", mn: "mn", my: "my" };
const entries = Object.entries(messages);

function batches(sourceEntries = entries, maxCharacters = 3_500) {
  const result = [];
  let current = [];
  let size = 0;
  for (const entry of sourceEntries) {
    if (current.length && size + entry[1].length > maxCharacters) { result.push(current); current = []; size = 0; }
    current.push(entry); size += entry[1].length + 30;
  }
  if (current.length) result.push(current);
  return result;
}

async function translateBatch(language, batch, attempt = 0) {
  const protectedBatch = batch.map(([key, value]) => {
    const variables = [];
    const protectedValue = value.replace(/\{([^}]+)\}/g, (_match, variable) => {
      variables.push(variable);
      return `{${variables.length - 1}}`;
    });
    return { key, protectedValue, variables };
  });
  const text = protectedBatch.map(({ protectedValue }, index) => `[[[${index}]]]\n${protectedValue}`).join("\n");
  const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
  endpoint.search = new URLSearchParams({ client: "gtx", sl: "en", tl: googleCodes[language] || language, dt: "t", q: text }).toString();
  const response = await fetch(endpoint, { headers: { "user-agent": "Mozilla/5.0 NaruCare locale generator" } });
  if (!response.ok) {
    if (attempt < 3) { await new Promise((resolve) => setTimeout(resolve, 1_500 * (attempt + 1))); return translateBatch(language, batch, attempt + 1); }
    throw new Error(`${language}: translation request failed (${response.status})`);
  }
  const data = await response.json();
  const combined = Array.isArray(data?.[0]) ? data[0].map((part) => part?.[0] || "").join("") : "";
  const translated = {};
  const pattern = /\[\[\[(\d+)\]\]\]\s*([\s\S]*?)(?=\[\[\[\d+\]\]\]|$)/g;
  for (const match of combined.matchAll(pattern)) {
    // Some translation responses split the next "[[[n]]]" marker and leave a
    // lone opening bracket on the previous value. Never persist that marker
    // fragment as user-facing copy.
    const source = protectedBatch[Number(match[1])];
    let value = match[2].trim().replace(/\s*\[\s*$/u, "").trim();
    value = value.replace(/\{\s*(\d+)\s*\}/g, (_placeholder, index) => {
      const variable = source.variables[Number(index)];
      return variable === undefined ? _placeholder : `{${variable}}`;
    });
    translated[source.key] = value;
  }
  const variableNames = (value) => [...value.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort().join("|");
  const placeholdersValid = batch.every(([key, value]) => variableNames(translated[key] || "") === variableNames(value));
  if (Object.keys(translated).length !== batch.length || !placeholdersValid) {
    if (batch.length > 1) {
      const middle = Math.ceil(batch.length / 2);
      return { ...await translateBatch(language, batch.slice(0, middle)), ...await translateBatch(language, batch.slice(middle)) };
    }
    throw new Error(`${language}: marker or placeholder mismatch (${Object.keys(translated).length}/${batch.length})`);
  }
  return translated;
}

let output = {};
try { output = JSON.parse(await readFile(outputPath, "utf8")); } catch { output = {}; }
for (const messagesForLocale of Object.values(output)) {
  for (const key of Object.keys(messagesForLocale)) {
    messagesForLocale[key] = messagesForLocale[key].replace(/\s*\[\s*$/u, "").trim();
  }
}
for (const language of targets) {
  if (force) output[language] = {};
  else output[language] ||= {};
  const missingEntries = entries.filter(([key]) => !output[language][key]?.trim());
  if (!missingEntries.length && Object.keys(output[language] || {}).length === entries.length) {
    process.stdout.write(`${language}: already complete (${entries.length} messages)\n`);
    continue;
  }
  for (const batch of batches(force ? entries : missingEntries)) {
    Object.assign(output[language], await translateBatch(language, batch));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  process.stdout.write(`${language}: ${Object.keys(output[language]).length} messages\n`);
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
}

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
