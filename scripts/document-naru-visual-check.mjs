import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const output = new URL("../.visual-check/document-naru/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const sourceText = "Synthetic report for interface testing.\nHemoglobin: 13 g/dL.\nThis is a synthetic fixture, not a patient record.";

async function scenario(width, locale) {
  const mobile = width <= 1024;
  const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 }, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript((language) => {
    localStorage.setItem("narucare-session", "synthetic-document-chat-session");
    localStorage.setItem("narucare-locale", language);
  }, locale);
  const page = await context.newPage();
  const errors = [];
  const questions = [];
  const medicalWrites = [];
  let failQuestion = false;
  let holdNextQuestion = false;
  let releaseQuestion;
  let saved;
  const otherDocument = { id: "doc-chat-2", name: "Other synthetic document.txt", mimeType: "text/plain", size: 60, sourceLanguage: "en", targetLanguage: locale, status: "uploaded", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sourceText: "A separate synthetic document, unrelated to the first report.", translatedText: "" };
  let translations = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
    if (path === "/api/me") return json({ id: "document-chat-test", card: null });
    if (request.method() !== "GET" && ["/api/card", "/api/records", "/api/chat", "/api/chat/memory"].includes(path)) medicalWrites.push(path);
    if (path === "/api/documents" && request.method() === "POST") {
      saved = { id: "doc-chat-1", name: "Synthetic report with a long descriptive filename for mobile.txt", mimeType: "text/plain", size: 140, sourceLanguage: "en", targetLanguage: locale, status: "uploaded", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sourceText, translatedText: "" };
      return json(saved, 201);
    }
    if (path === "/api/documents/doc-chat-1/chat") {
      const body = request.postDataJSON();
      assert.equal(request.headers().authorization, "Bearer synthetic-document-chat-session");
      questions.push(body);
      if (holdNextQuestion) {
        holdNextQuestion = false;
        await new Promise((resolve) => { releaseQuestion = resolve; });
        return json({ reply: "STALE REPLY THAT MUST NEVER APPEAR" }).catch(() => {});
      }
      if (failQuestion) return json({ error: "document_chat_failed" }, 502);
      return json({ reply: `Synthetic explanation ${questions.length}.\nThis explains the report; the result alone does not establish a diagnosis.` });
    }
    if (path.endsWith("/translate")) { translations++; return json(saved); }
    if (path === "/api/documents/doc-chat-1" && request.method() === "DELETE") { saved = null; return json({ ok: true }); }
    if (path === "/api/documents/doc-chat-1") return json(saved);
    if (path === "/api/documents/doc-chat-2") return json(otherDocument);
    return json({ history: [], records: [], orders: [], documents: [...(saved ? [saved] : []), otherDocument] });
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(mobile ? ".bottom-nav" : ".side-nav").locator('button').filter({ has: page.locator("svg.lucide-camera") }).click();
  await page.locator('input[type="file"][accept*=".pdf"]').setInputFiles({ name: "synthetic-report.txt", mimeType: "text/plain", buffer: Buffer.from(sourceText) });
  await page.locator(".document-consent input").check();
  await page.locator(".document-save-consent input").check();
  await page.locator(".medical-document-upload-submit").click();
  await page.locator("#medical-document-source-text").waitFor();
  await page.locator(".medical-document-ask .button").click();
  const chat = page.locator(".document-naru-chat");
  await chat.waitFor({ state: "visible" });
  assert.equal(await page.locator(".gate-modal:visible").count(), 0, "Document questions must not require a medical card");
  assert.equal(translations, 0, "Users can ask before waiting for a translation");
  assert.equal(await chat.locator(".document-naru-attachment strong").textContent(), saved.name);
  await chat.locator(".document-consent input").uncheck();
  assert.equal(await chat.locator(".document-naru-suggestions button").first().isDisabled(), true);
  await chat.locator(".document-naru-attachment button").click();
  assert.equal(await page.locator(".medical-documents .document-consent input").isChecked(), false);
  assert.equal(await page.locator(".medical-document-ask .button").isDisabled(), true);
  await page.locator(".medical-documents .document-consent input").check();
  await page.locator(".medical-document-ask .button").click();
  assert.ok(await chat.locator(".naru-pose img").count() >= 2, "Use the official Naru character");
  await page.screenshot({ path: fileURLToPath(new URL(`welcome-${locale}-${width}.png`, output)), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Document chat overflows horizontally");
  const composerBox = await chat.locator(".document-naru-composer").boundingBox();
  if (mobile) {
    const navBox = await page.locator(".bottom-nav").boundingBox();
    assert.ok(composerBox.y + composerBox.height <= navBox.y, "Composer must remain above mobile navigation");
  }

  await chat.locator(".document-naru-suggestions button").first().click();
  await chat.locator(".document-naru-message-assistant").waitFor();
  assert.equal(questions[0].sourceText, sourceText);
  assert.deepEqual(questions[0].history, []);
  assert.equal(questions[0].locale, locale);
  await chat.locator("textarea").fill("Please explain what is still uncertain.");
  await chat.locator('button[type="submit"]').click();
  await page.waitForFunction(() => document.querySelectorAll(".document-naru-message-assistant").length === 2);
  assert.deepEqual(questions[1].history.map((message) => message.role), ["user", "assistant"]);

  // Going back to the document and returning preserves this document's conversation.
  await chat.locator(".document-naru-attachment button").click();
  await page.locator(".medical-document-ask .button").click();
  await chat.waitFor({ state: "visible" });
  assert.equal(await chat.locator(".document-naru-message-assistant").count(), 2);

  failQuestion = true;
  await chat.locator("textarea").fill("What should I ask my clinician?");
  await chat.locator('button[type="submit"]').click();
  await chat.locator('[role="alert"]').waitFor();
  failQuestion = false;
  await chat.locator('[role="alert"] button').click();
  await page.waitForFunction(() => document.querySelectorAll(".document-naru-message-assistant").length === 3);
  assert.equal(await chat.locator(".document-naru-message-user").count(), 3, "Retry must not duplicate the question");
  assert.deepEqual(questions[2], questions[3], "Retry uses the same question and completed history");
  await page.screenshot({ path: fileURLToPath(new URL(`followup-${locale}-${width}.png`, output)), fullPage: true });

  // Correcting OCR must replace the context rather than reuse interpretations of old text.
  await chat.locator(".document-naru-attachment button").click();
  await page.locator("#medical-document-source-text").fill(`${sourceText}\nCorrected value: 14 g/dL.`);
  await page.locator(".medical-document-ask .button").click();
  assert.equal(await chat.locator(".document-naru-message-assistant").count(), 0);

  holdNextQuestion = true;
  const pendingRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/documents/doc-chat-1/chat");
  await chat.locator(".document-naru-suggestions button").first().click();
  await pendingRequest;
  assert.equal(await chat.locator('button[type="submit"]').isDisabled(), true);
  await chat.locator(".document-naru-attachment button").click();
  const finalText = `${sourceText}\nCorrected value: 15 g/dL.`;
  await page.locator("#medical-document-source-text").fill(finalText);
  await page.locator(".medical-document-ask .button").click();
  releaseQuestion();
  await chat.locator("textarea").fill("Explain the corrected document.");
  await chat.locator('button[type="submit"]').click();
  await chat.locator(".document-naru-message-assistant").waitFor();
  assert.deepEqual(questions.at(-1).history, []);
  assert.equal(questions.at(-1).sourceText, finalText);
  assert.equal(await chat.getByText("STALE REPLY THAT MUST NEVER APPEAR").count(), 0);
  assert.equal(await chat.locator(".document-naru-message-assistant").count(), 1);

  // Viewing another saved document must not silently replace the chat's attachment.
  const nav = page.locator(mobile ? ".bottom-nav" : ".side-nav");
  await nav.locator("button").filter({ has: page.locator("svg.lucide-camera") }).click();
  await page.locator(".medical-document-history-list li").filter({ hasText: otherDocument.name }).locator(".medical-document-history-actions .button").click();
  await page.waitForFunction((expected) => document.querySelector("#medical-document-source-text")?.value === expected, otherDocument.sourceText);
  await nav.locator("button").filter({ has: page.locator("svg.lucide-message-circle-more") }).click();
  await chat.waitFor({ state: "visible" });
  assert.equal(await chat.locator(".document-naru-attachment strong").textContent(), saved.name);
  await chat.locator(".document-naru-attachment button").click();
  await page.waitForFunction((expected) => document.querySelector("#medical-document-source-text")?.value === expected, sourceText);
  assert.equal(await page.locator(".medical-document-review .medical-document-section-heading p").textContent(), saved.name);

  // Deleting the attached document invalidates the hidden Naru conversation too.
  await page.locator(".medical-document-history-list li").filter({ hasText: saved.name }).locator(".medical-document-icon-button").click();
  await page.locator(".medical-document-delete-confirm .button-danger").click();
  await page.locator(".medical-document-review").waitFor({ state: "detached" });
  await nav.locator("button").filter({ has: page.locator("svg.lucide-message-circle-more") }).click();
  await page.locator(".agent-grid").waitFor({ state: "visible" });
  assert.equal(await page.locator(".document-naru-chat").count(), 0);

  // Attaching the remaining document starts empty, and close returns to ordinary Naru.
  await nav.locator("button").filter({ has: page.locator("svg.lucide-camera") }).click();
  await page.locator(".medical-document-history-list li").filter({ hasText: otherDocument.name }).locator(".medical-document-history-actions .button").click();
  await page.locator(".medical-documents .document-consent input").check();
  await page.locator(".medical-document-ask .button").click();
  await chat.waitFor({ state: "visible" });
  assert.equal(await chat.locator(".document-naru-message").count(), 0);
  await chat.locator(".document-naru-close").click();
  await page.locator(".agent-grid").waitFor({ state: "visible" });
  assert.deepEqual(medicalWrites, [], "Document Q&A must not write medical cards, general memory or visit records");
  assert.deepEqual(errors, []);
  console.log(`Document Naru ${locale} ${width}px: no-card entry, attached source, follow-ups, same-document retention, retry, edited source reset, stale reply cancellation, correct attachment return, deletion cleanup, detach and layout passed.`);
  await context.close();
}

try {
  await scenario(1440, "en");
  await scenario(390, "zh-CN");
  await scenario(360, "ko");
  await scenario(820, "ja");
} finally {
  await browser.close();
}
