import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const output = new URL("../.visual-check/document-locales/", import.meta.url);
await mkdir(output, { recursive: true });
const i18n = await readFile(new URL("../src/i18n.tsx", import.meta.url), "utf8");
const options = runInNewContext(`(${i18n.match(/export const localeOptions[^=]*= (\[[\s\S]*?\n\]);/)[1]})`);
const medicalSource = await readFile(new URL("../src/medicalDocumentCopy.ts", import.meta.url), "utf8");
const conversationSource = await readFile(new URL("../src/documentConversationCopy.ts", import.meta.url), "utf8");
const readObject = (source, marker, end) => {
  const start = source.indexOf("{", source.indexOf(marker));
  const stop = source.indexOf(end, start);
  return runInNewContext(`(${source.slice(start, stop + end.lastIndexOf("}") + 1)})`);
};
async function copyFor(code) {
  if (!["en", "zh-CN", "ko", "ja"].includes(code)) return JSON.parse(await readFile(new URL(`../src/documentLocales/${code}.json`, import.meta.url), "utf8"));
  const medical = code === "en" ? readObject(medicalSource, "const en =", "\n};") : readObject(medicalSource, code === "zh-CN" ? '  "zh-CN": {' : `  ${code}: {`, "\n  },");
  const conversation = readObject(conversationSource, code === "en" ? "const en =" : `const ${code === "zh-CN" ? "zh" : code}: Copy =`, "\n};");
  return { medical, conversation };
}
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const screenshots = new Set(["ar", "ur", "fa", "hi", "bn", "my", "th", "mn", "de", "pt-BR"]);

async function scenario(option) {
  const { code, direction = "ltr" } = option;
  const { medical, conversation } = await copyFor(code);
  const context = await browser.newContext({ viewport: { width: 360, height: 900 }, isMobile: true, hasTouch: true });
  await context.addInitScript((locale) => {
    localStorage.setItem("narucare-session", "synthetic-locale-session");
    localStorage.setItem("narucare-locale", locale);
  }, code);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let saved;
  let uploadCount = 0;
  let questionCount = 0;
  let requestedLocale = "";
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path === "/api/me") return json({ id: "locale-test", card: null });
    if (path === "/api/documents" && request.method() === "POST") {
      uploadCount++;
      if (uploadCount === 1) return json({ error: "document_extraction_failed" }, 502);
      assert.match(request.postData(), new RegExp(`name="targetLanguage"\\r\\n\\r\\n${code}\\r\\n`));
      saved = { id: "locale-doc", name: "synthetic-locale.txt", mimeType: "text/plain", size: 40, sourceLanguage: "en", targetLanguage: code, status: "uploaded", createdAt: "2026-09-07", updatedAt: "2026-09-07", sourceText: "Synthetic interface test. No patient data.", translatedText: "" };
      return json(saved, 201);
    }
    if (path === "/api/documents/locale-doc/chat") {
      const body = request.postDataJSON();
      requestedLocale = body.locale;
      questionCount++;
      if (questionCount === 1) return json({ error: "document_answer_failed" }, 502);
      const currentCopy = await copyFor(body.locale);
      return json({ reply: currentCopy.conversation.welcome });
    }
    return json({ documents: saved ? [saved] : [], history: [], records: [], orders: [] });
  });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const nav = page.locator(".bottom-nav .document-nav");
  await nav.waitFor();
  assert.equal(await nav.locator("small").textContent(), medical.navTitle);
  await nav.click();
  const documents = page.locator(".medical-documents");
  await documents.waitFor({ state: "visible" });
  assert.equal(await documents.getAttribute("dir"), direction);
  assert.equal(await documents.locator(".medical-document-intro h2").textContent(), medical.introduction);
  assert.equal(await documents.locator(".medical-document-languages select").nth(1).inputValue(), code);
  assert.deepEqual(await documents.locator(".medical-document-upload-options strong").allTextContents(), [medical.takePhoto, medical.uploadPhoto, medical.uploadFile]);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${code}: upload overflow`);
  if (screenshots.has(code)) await page.screenshot({ path: fileURLToPath(new URL(`upload-${code}.png`, output)), fullPage: true });
  await documents.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "synthetic-locale.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic interface test. No patient data.") });
  await documents.locator(".document-consent input").check();
  await documents.locator(".document-save-consent input").check();
  await documents.locator(".medical-document-upload-submit").click();
  const uploadError = documents.locator(".medical-document-error");
  await uploadError.waitFor();
  assert.equal(await uploadError.locator("p").textContent(), medical.processingError);
  await uploadError.getByRole("button", { name: medical.retry, exact: true }).click();
  await documents.locator("#medical-document-source-text").waitFor();
  assert.equal(await documents.locator(".medical-document-ask p").textContent(), conversation.askNaruHelp);
  await documents.getByRole("button", { name: conversation.askNaru, exact: true }).click();
  const chat = page.locator(".document-naru-chat");
  await chat.waitFor({ state: "visible" });
  assert.equal(await chat.getAttribute("dir"), direction);
  assert.equal(await chat.locator("h2").textContent(), conversation.title);
  assert.deepEqual(await chat.locator(".document-naru-suggestions button").allTextContents(), [...conversation.questionLabels]);
  assert.equal(await chat.locator("textarea").getAttribute("placeholder"), conversation.placeholder);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${code}: chat overflow`);
  const composer = await chat.locator(".document-naru-composer").boundingBox();
  const bottom = await page.locator(".bottom-nav").boundingBox();
  assert.ok(composer.y + composer.height <= bottom.y, `${code}: composer overlaps navigation`);
  if (screenshots.has(code)) await page.screenshot({ path: fileURLToPath(new URL(`chat-${code}.png`, output)), fullPage: true });
  await chat.locator(".document-naru-suggestions button").first().click();
  await chat.locator(".document-naru-error").waitFor();
  assert.equal(await chat.locator(".document-naru-error p").textContent(), conversation.error);
  // Switch while an error is visible: existing controls and the error must relocalize.
  if (code === "ar") {
    const french = await copyFor("fr");
    await page.locator(".page-header .language-button").click();
    await page.locator(".language-list [role=radio]").filter({ hasText: "Français" }).click();
    await page.locator(".language-continue").click();
    await chat.waitFor({ state: "visible" });
    assert.equal(await chat.getAttribute("dir"), "ltr");
    assert.equal(await chat.locator(".document-naru-error p").textContent(), french.conversation.error);
    await chat.getByRole("button", { name: french.conversation.retry, exact: true }).click();
    await chat.locator(".document-naru-message-assistant").waitFor();
    assert.equal(requestedLocale, "fr");
    await chat.locator(".document-naru-attachment button").click();
    assert.equal(await documents.locator(".medical-document-languages select").nth(1).inputValue(), "fr");
  } else {
    await chat.getByRole("button", { name: conversation.retry, exact: true }).click();
    await chat.locator(".document-naru-message-assistant").waitFor();
    assert.equal(requestedLocale, code);
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`${code}: localized entry, upload, errors/retry, document questions, reply locale and ${direction} mobile layout passed.`);
}
try { for (const option of options) await scenario(option); }
finally { await browser.close(); }
