import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const output = new URL("../.visual-check/document-consent/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const sourceText = "SYNTHETIC TEST DOCUMENT - NO PATIENT DATA\nFollow-up visit: 2026-10-15. Bring this document.";

async function temporaryScenario(width) {
  const mobile = width < 1024;
  const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(() => {
    localStorage.setItem("narucare-session", "synthetic-consent-session");
    localStorage.setItem("narucare-locale", "ko");
  });
  const page = await context.newPage();
  const errors = [];
  const writes = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let document;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/me") return json({ id: "synthetic-consent-user", card: null });
    if (path === "/api/documents" && request.method() === "POST") {
      const form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
      assert.equal(form.get("processingConsent"), "true");
      assert.equal(form.get("saveToHistory"), "false");
      writes.push(path);
      document = { id: "temporary-test", name: "Synthetic document.txt", mimeType: "text/plain", size: 100, sourceText, sourceLanguage: "en", targetLanguage: "ko", translatedText: "", status: "uploaded", stored: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      return json(document, 201);
    }
    if (path.endsWith("/translate")) {
      assert.equal(request.postDataJSON().processingConsent, true);
      writes.push(path);
      return json({ ...document, translatedText: "합성 테스트 문서. 재방문: 2026-10-15. 이 문서를 가져오세요.", status: "translated" });
    }
    if (path.endsWith("/chat")) {
      assert.equal(request.postDataJSON().processingConsent, true);
      writes.push(path);
      return json({ reply: "이 문서는 테스트용 안내문입니다. 2026년 10월 15일 재방문할 때 문서를 가져오라는 내용입니다." });
    }
    return json({ history: [], documents: [], records: [], orders: [] });
  });
  const nav = () => page.locator(mobile ? ".bottom-nav" : ".side-nav").locator("button").filter({ has: page.locator("svg.lucide-camera") });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await nav().click();
  const picker = page.locator('input[type="file"][accept*=".pdf"]');
  await picker.setInputFiles({ name: "Synthetic document.txt", mimeType: "text/plain", buffer: Buffer.from(sourceText) });
  const consent = page.locator(".medical-documents .document-consent input");
  const save = page.locator(".document-save-consent input");
  assert.equal(await consent.isChecked(), false);
  assert.equal(await save.isChecked(), false);
  assert.equal(await page.locator(".medical-document-upload-submit").isDisabled(), true);
  assert.deepEqual(writes, []);
  await consent.check();
  await save.check();
  await picker.setInputFiles({ name: "Replacement.txt", mimeType: "text/plain", buffer: Buffer.from(sourceText) });
  assert.equal(await consent.isChecked(), false);
  assert.equal(await save.isChecked(), false);
  await page.screenshot({ path: fileURLToPath(new URL(`consent-${width}.png`, output)), fullPage: true });
  await consent.check();
  await page.locator(".medical-document-upload-submit").click();
  await page.locator(".document-temporary-notice").waitFor();
  assert.equal(await page.locator(".medical-document-history-list li").count(), 0);
  await page.locator(".medical-document-review-actions .button").first().click();
  await page.locator(".medical-document-complete").waitFor();
  await page.locator(".medical-document-ask .button").click();
  const chat = page.locator(".document-naru-chat");
  await chat.locator(".document-naru-suggestions button").first().click();
  await chat.locator(".document-naru-message-assistant").waitFor();
  await page.screenshot({ path: fileURLToPath(new URL(`explanation-${width}.png`, output)), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.equal(storage.includes("SYNTHETIC TEST DOCUMENT"), false);
  await chat.locator(".document-consent input").uncheck();
  await chat.locator(".document-naru-attachment button").click();
  assert.equal(await consent.isChecked(), false);
  assert.equal(await page.locator(".medical-document-review-actions .button").first().isDisabled(), true);
  await page.locator(".document-temporary-notice .button").click();
  assert.equal(await page.locator("#medical-document-source-text").count(), 0);
  assert.equal(await page.locator(".document-naru-chat").count(), 0);
  assert.equal(writes.length, 3);
  await page.reload({ waitUntil: "networkidle" });
  await nav().click();
  assert.equal(await page.locator("#medical-document-source-text").count(), 0);
  assert.equal(await page.locator(".document-consent input").count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`Consent ${width}px: explicit consent, per-file reset, optional storage, temporary OCR/translation/chat, revocation, close, refresh and layout passed.`);
}

async function liveCheck() {
  const api = process.env.DOCUMENT_API_URL || "http://127.0.0.1:8787";
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(api).hostname), "Live checks are limited to the local backend");
  const call = (path, init = {}) => fetch(`${api}${path}`, { ...init, signal: AbortSignal.timeout(100_000) });
  const account = { id: `ocr-consent-${Date.now()}`, password: crypto.randomUUID() };
  const auth = await call("/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(account) });
  assert.equal(auth.status, 201, "Synthetic account registration failed");
  const { token } = await auth.json();
  const headers = { authorization: `Bearer ${token}` };
  const page = await browser.newPage({ viewport: { width: 850, height: 400 } });
  try {
    await page.setContent(`<main style="font:24px Arial;color:#111;padding:28px"><h1>Synthetic Test Document</h1><p>NO PATIENT DATA</p><p>Follow-up visit: 2026-10-15.</p><p>Bring this document.</p></main>`);
    const files = [
      ["synthetic.png", "image/png", await page.screenshot()],
      ["synthetic.pdf", "application/pdf", await page.pdf({ format: "A4" })],
    ];
    const extracted = [];
    for (const [name, type, bytes] of files) {
      const form = new FormData();
      form.set("file", new File([bytes], name, { type }));
      form.set("sourceLanguage", "en");
      form.set("targetLanguage", "ko");
      const rejected = await call("/api/documents", { method: "POST", headers, body: form });
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).error, "document_consent_required");
      form.set("processingConsent", "true");
      const response = await call("/api/documents", { method: "POST", headers, body: form });
      const document = await response.json();
      assert.equal(response.status, 201, JSON.stringify(document));
      assert.equal(document.stored, false);
      assert.match(document.sourceText, /2026-10-15/);
      extracted.push(document);
      console.log(`Live ${type}: consent rejection and OpenAI OCR passed; temporary only.`);
    }
    const document = extracted[0];
    const jsonHeaders = { ...headers, "content-type": "application/json" };
    const translation = await call(`/api/documents/${document.id}/translate`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ processingConsent: true, sourceText: document.sourceText, sourceLanguage: "en", targetLanguage: "ko" }) });
    assert.equal(translation.status, 200, await translation.clone().text());
    assert.match((await translation.json()).translatedText, /2026-10-15/);
    const chat = await call(`/api/documents/${document.id}/chat`, { method: "POST", headers: jsonHeaders, body: JSON.stringify({ processingConsent: true, documentName: document.name, sourceText: document.sourceText, sourceLanguage: "en", locale: "ko", message: "이 테스트 문서 내용을 짧게 설명해줘." }) });
    assert.equal(chat.status, 200, await chat.clone().text());
    assert.ok((await chat.json()).reply.length > 0);
    const history = await call("/api/documents", { headers });
    assert.deepEqual((await history.json()).documents, []);
    console.log("Live translation and explanation passed; document history remains empty.");
  } finally {
    await page.close();
    await call("/api/auth/logout", { method: "POST", headers });
  }
}

try {
  await temporaryScenario(1440);
  await temporaryScenario(390);
  if (process.env.DOCUMENT_LIVE_CHECK === "1") await liveCheck();
} finally { await browser.close(); }
