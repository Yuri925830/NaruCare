import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const output = new URL("../.visual-check/documents/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const sourceText = "Synthetic test document\nDrug A 5 mg\nTake 1 tablet daily for 3 days.\nNo known allergies.";
const translatedText = "合成测试文档\n药物 A 5 mg\n每日服用 1 片，连续 3 天。\n无已知过敏。";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");

async function scenario(mobile) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile, permissions: ["camera"] });
  await context.addInitScript(() => {
    localStorage.setItem("narucare-session", "synthetic-document-test-session");
    localStorage.setItem("narucare-locale", "en");
    window.__documentCameraStreams = [];
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      window.__documentCameraStreams.push(stream);
      return stream;
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let saved = null;
  let failUpload = false;
  let translationRequests = 0;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path === "/api/me") return json({ id: "document-test", card: null });
    if (path === "/api/records") return json({ records: [] });
    if (path === "/api/orders") return json({ orders: [] });
    if (path === "/api/chat/history") return json({ history: [] });
    if (path === "/api/documents" && request.method() === "GET") return json({ documents: saved ? [saved] : [] });
    if (path === "/api/documents" && request.method() === "POST") {
      assert.equal(request.headers().authorization, "Bearer synthetic-document-test-session");
      assert.match(request.headers()["content-type"], /multipart\/form-data; boundary=/);
      if (failUpload) return json({ error: "document_extraction_failed" }, 502);
      const name = request.postData()?.match(/filename="([^"]+)"/)?.[1] || "medical-document.jpg";
      saved = { id: "doc-1", name, mimeType: name.endsWith(".txt") ? "text/plain" : "image/jpeg", size: 100, sourceLanguage: "auto", targetLanguage: "zh-CN", status: "uploaded", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sourceText, translatedText: "" };
      return json(saved, 201);
    }
    if (path === "/api/documents/doc-1/translate") {
      translationRequests++;
      const body = request.postDataJSON();
      assert.match(body.sourceText, /5 mg/);
      saved = { ...saved, ...body, status: "translated", translatedText, updatedAt: new Date().toISOString() };
      return json(saved);
    }
    if (path === "/api/documents/doc-1/file") {
      assert.equal(request.headers().authorization, "Bearer synthetic-document-test-session");
      return route.fulfill({ status: 200, contentType: "text/plain", body: sourceText });
    }
    if (path === "/api/documents/doc-1" && request.method() === "DELETE") { saved = null; return json({ ok: true }); }
    if (path === "/api/documents/doc-1") return json(saved);
    return json({ ok: true });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (mobile) {
    await page.locator(".bottom-nav button").last().click();
    await page.locator(".profile-grid").getByRole("button", { name: /Medical documents/ }).click();
  } else await page.locator(".side-nav").getByRole("button", { name: "Photo translation", exact: true }).click();
  await page.getByRole("button", { name: /Upload a photo/ }).waitFor();
  assert.equal(await page.locator('input[type="file"][capture="environment"]').count(), 1);
  assert.equal(await page.locator('input[type="file"]').count(), 3);
  if (!mobile) {
    await page.getByRole("button", { name: /Take a photo/ }).click();
    await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2, null, { timeout: 10000 }).catch(async (error) => {
      console.error(await page.evaluate(() => ({ hidden: document.hidden, dialog: document.querySelector("dialog")?.textContent, video: document.querySelector("video")?.readyState, streams: window.__documentCameraStreams.map((stream) => stream.getTracks().map((track) => ({ state: track.readyState, enabled: track.enabled }))) })));
      throw error;
    });
    await page.getByRole("button", { name: "Capture photo", exact: true }).click();
    await page.waitForFunction(() => window.__documentCameraStreams.length > 0 && window.__documentCameraStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended")));
    await page.getByRole("button", { name: "Upload and extract text", exact: true }).waitFor();
  }
  // Locate the file picker by its PDF accept list, independent of translated button labels.
  if (mobile) await page.getByLabel("Upload a photo", { exact: true }).setInputFiles({ name: "test-photo.png", mimeType: "image/png", buffer: png });
  else await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "test-record.txt", mimeType: "text/plain", buffer: Buffer.from(sourceText) });
  await page.locator(".medical-document-languages select").nth(1).selectOption("zh-CN");
  failUpload = true;
  await page.getByRole("button", { name: "Upload and extract text", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: /could not be read/ }).waitFor();
  failUpload = false;
  await page.getByRole("button", { name: "Upload and extract text", exact: true }).click();
  await page.locator("#medical-document-source-text").waitFor();
  await page.locator("#medical-document-source-text").fill(`${sourceText}\nReviewed.`);
  await page.getByRole("button", { name: "Translate document", exact: true }).click();
  await page.getByRole("button", { name: "Download translation", exact: true }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download translation", exact: true }).click();
  assert.match((await downloadPromise).suggestedFilename(), /\.txt$/);
  const originalDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download original", exact: true }).click();
  await originalDownload;
  await page.screenshot({ path: fileURLToPath(new URL(mobile ? "mobile.png" : "desktop.png", output)), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Document page overflows horizontally");
  await page.locator("#medical-document-source-text").fill(`${sourceText}\nChanged after translation.`);
  assert.equal(await page.getByRole("button", { name: "Download translation", exact: true }).count(), 0, "Stale translation must not be exportable");
  await page.getByRole("button", { name: "Translate document", exact: true }).click();
  await page.getByRole("button", { name: "Download translation", exact: true }).waitFor();
  assert.equal(translationRequests, 2);
  await page.getByRole("button", { name: /^Delete:/ }).first().click();
  await page.getByText("Delete this document and its translation? This cannot be undone.").waitFor();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  await page.getByText("Your documents will appear here", { exact: true }).waitFor();
  assert.equal(saved, null);
  if (!mobile) {
    await page.getByRole("button", { name: /Take a photo/ }).click();
    // Chromium's fake camera may disappear after release; both a new stream and
    // the accessible device-photo fallback are valid outcomes of reopening it.
    await page.waitForFunction(() => document.querySelector("video")?.readyState >= 2 || document.querySelector(".medical-document-camera-error"));
    if (await page.locator(".medical-document-camera-error").count()) assert.equal(await page.getByRole("button", { name: "Use device camera / choose photo", exact: true }).isEnabled(), true);
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.waitForFunction(() => window.__documentCameraStreams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended")));
    await page.evaluate(() => { navigator.mediaDevices.getUserMedia = async () => { throw new DOMException("Denied", "NotAllowedError"); }; });
    await page.getByRole("button", { name: /Take a photo/ }).click();
    await page.getByRole("dialog").getByRole("alert").filter({ hasText: /Camera access was denied/ }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  }
  assert.deepEqual(errors, []);
  console.log(`${mobile ? "Mobile" : "Desktop"}: camera inputs, upload retry, editable OCR, translation, downloads, stale-result protection, deletion and layout passed.`);
  await context.close();
}

async function localizedLayout(locale, width) {
  const context = await browser.newContext({ viewport: { width, height: width < 760 ? 844 : 1000 } });
  await context.addInitScript((code) => {
    localStorage.setItem("narucare-session", "synthetic-layout-session");
    localStorage.setItem("narucare-locale", code);
  }, locale);
  const page = await context.newPage();
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/me" ? { id: "layout-test", card: null } : { history: [], records: [], orders: [], documents: [] };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (width < 760) {
    await page.locator(".bottom-nav button").last().click();
    await page.locator(".profile-grid button").nth(1).click();
  } else await page.locator(".side-nav").getByRole("button", { name: locale === "ko" ? "사진 번역" : "拍照翻译", exact: true }).click();
  await page.locator(".medical-document-upload-options").waitFor();
  await page.waitForFunction(() => [...document.querySelectorAll(".medical-documents .naru-pose img")].every((img) => img.complete && img.naturalWidth > 0));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${locale} ${width}px overflows`);
  assert.equal(await page.locator(".medical-document-upload-options > button").count(), 3);
  await page.screenshot({ path: fileURLToPath(new URL(`intro-${locale}-${width}.png`, output)), fullPage: true });
  await context.close();
  console.log(`${locale} ${width}px: localized entry, introduction, Naru artwork and responsive layout passed.`);
}

try {
  await scenario(false);
  await scenario(true);
  await localizedLayout("zh-CN", 1440);
  await localizedLayout("zh-CN", 390);
  await localizedLayout("ko", 360);
}
finally { await browser.close(); }
