import { chromium } from "playwright-core";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = new URL("../.visual-check/", import.meta.url);
await mkdir(output, { recursive: true });
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".png")) await unlink(new URL(entry.name, output));
}
const shot = (name) => fileURLToPath(new URL(name, output));
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  permissions: ["geolocation", "microphone"],
  geolocation: { latitude: 37.5665, longitude: 126.978 },
});
await context.addInitScript(() => {
  class MockSpeechRecognition {
    continuous = false;
    interimResults = false;
    lang = "";
    onresult = null;
    onerror = null;
    onend = null;
    start() {
      window.__voiceRecognitionStarted = this.lang;
      window.setTimeout(() => {
        this.onresult?.({ results: [{ 0: { transcript: "배가 아파요" }, isFinal: true }] });
        this.onend?.();
      }, 30);
    }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }
  window.SpeechRecognition = MockSpeechRecognition;
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.stack || error.message));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("ERR_FAILED")) errors.push(message.text()); });
await page.route("**/api/**", (route) => route.abort());
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".auth-art > .language-button").click();
await page.locator(".language-page").waitFor();
await page.locator(".language-list button").filter({ hasText: "한국어" }).click();
if (!/계속/.test(await page.locator(".language-continue").innerText())) throw new Error("Korean locale did not replace the language action");
await page.locator(".language-list button").filter({ hasText: "中文（简体）" }).click();
await page.screenshot({ path: shot("00-language-desktop.png") });
await page.locator(".language-continue").click();
await page.locator(".auth-page").waitFor();
await page.screenshot({ path: shot("01-login-desktop.png") });

await page.locator(".auth-switch").click();
await page.screenshot({ path: shot("02-register-desktop.png") });
await page.locator('input[autocomplete="username"]').fill("visual-uu");
await page.locator('input[autocomplete="new-password"]').nth(0).fill("12345678");
await page.locator('input[autocomplete="new-password"]').nth(1).fill("12345678");
await page.locator('button[type="submit"]').click();
await page.locator(".agent-grid").waitFor();
await page.screenshot({ path: shot("03-agent-desktop.png") });

// In-app mobile language switching: the action must be visible immediately,
// RTL languages must not mirror the application shell, and returning must
// preserve the previous page state.
await page.setViewportSize({ width: 430, height: 932 });
await page.locator(".chat-composer input").fill("保留这段未发送的内容");
await page.locator(".page-header .language-button").click();
await page.locator(".in-app-language").waitFor();
const languageActionBox = await page.locator(".in-app-language .language-continue").boundingBox();
if (!languageActionBox || languageActionBox.y + languageActionBox.height > 850) throw new Error("Mobile in-app language confirmation is not immediately visible above navigation");
await page.locator(".language-list button").filter({ hasText: "العربية" }).click();
if (await page.evaluate(() => document.documentElement.dir) !== "ltr") throw new Error("RTL locale mirrored the full application layout");
await page.locator(".language-list button").filter({ hasText: "中文（简体）" }).click();
await page.locator(".in-app-language .language-continue").click();
await page.locator(".agent-grid").waitFor();
if (await page.locator(".chat-composer input").inputValue() !== "保留这段未发送的内容") throw new Error("Language return did not preserve the previous page state");
await page.locator(".chat-composer input").fill("");
await page.setViewportSize({ width: 1440, height: 900 });

await page.locator(".chat-composer input").fill("我肚子不舒服");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".gate-modal").waitFor();
await page.screenshot({ path: shot("04-card-gate-desktop.png") });
await page.locator(".gate-modal .button-primary").click();
await page.locator(".medical-card-form").waitFor();
await page.locator('[data-field="name"] input').fill("UU");
await page.locator('[data-field="nationality"] select').selectOption("CN");
const addressInput = page.locator('[data-field="address"] textarea');
if (await addressInput.getAttribute("required") !== null) throw new Error("Residential address must remain optional");
await addressInput.fill("서울특별시 중구 세종대로 110, 1203호");
await page.locator('[data-field="age"] input').fill("25");
await page.locator('[data-field="documentNumber"] input').fill("90******123");
await page.locator('[data-field="symptoms"] textarea').fill("暂时没有症状");
await page.screenshot({ path: shot("05-card-desktop.png") });
await page.locator(".medical-card-form > .button").click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("肚子疼，一直拉肚子，还吐了，今天吃了海鲜");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await page.locator(".side-nav button").first().click();
await page.locator(".medical-card-form").waitFor();
if (!/肚子疼/.test(await page.locator('[data-field="symptoms"] textarea').inputValue())) throw new Error("Chat symptoms were not written back to the medical card");
if (!/중국/.test(await page.locator('[data-field="nationality"] .korean-preview').innerText())) throw new Error("Nationality was not translated into Korean on the bilingual card");
await page.locator(".page-back").click();
await page.locator(".hospital-panel").waitFor();
const mapBefore = await page.locator(".hospital-layout .map-card").boundingBox();
const listBefore = await page.locator(".hospital-layout .hospital-list").boundingBox();
await page.locator(".hospital-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
const mapAfter = await page.locator(".hospital-layout .map-card").boundingBox();
const listAfter = await page.locator(".hospital-layout .hospital-list").boundingBox();
if (!mapBefore || !mapAfter || !listBefore || !listAfter || Math.abs(mapBefore.height - mapAfter.height) > 1 || Math.abs(listBefore.height - listAfter.height) > 1) throw new Error("Hospital map or list frame changed size while scrolling results");
await page.locator(".hospital-scroll").evaluate((element) => { element.scrollTop = 0; });
await page.screenshot({ path: shot("07-hospitals-desktop.png") });
await page.locator(".hospital-actions .button-primary").click();
await page.locator(".flow-panel").waitFor();
await page.screenshot({ path: shot("08-flow-desktop.png") });
await page.locator(".flow-choice-actions .button-secondary").click();
await page.locator(".hospital-panel").waitFor();
if (!await page.locator(".hospital-item.selected").count()) throw new Error("Hospital selection was not preserved after returning from visit flow");
await page.locator(".hospital-actions .button-primary").click();
await page.locator(".flow-choice-actions .button-primary").click();
await page.locator(".navigation-panel").waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: shot("09-navigation-desktop.png") });

await page.locator(".route-info > button.button-secondary").click();
await page.locator(".translation-panel").waitFor();
await page.waitForTimeout(300);
await page.locator(".mic-button").click();
await page.waitForTimeout(100);
const voiceLanguage = await page.evaluate(() => window.__voiceRecognitionStarted || "");
if (!voiceLanguage) throw new Error("Browser speech recognition did not start");
await page.screenshot({ path: shot("10-translation-desktop.png") });

await page.locator(".side-nav button").nth(3).click();
await page.locator(".emergency-confirm-panel").waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("11-emergency-desktop.png") });
await page.locator(".emergency-copy > .button-danger").click();
await page.locator(".emergency-calling-panel").waitFor();
await page.waitForTimeout(150);
await page.screenshot({ path: shot("11-emergency-calling-desktop.png") });

await page.locator(".side-nav button").nth(1).click();
await page.locator(".agent-grid").waitFor();
await page.locator(".quick-link").nth(3).click();
await page.locator(".companion-notice-panel").waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("12-companion-notice-desktop.png") });
await page.locator(".agree-check input").check();
await page.locator(".notice-actions > .button").click();
await page.locator(".filter-panel").waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("13-companion-filter-desktop.png") });
await page.locator(".filter-panel > .button").click();
await page.locator(".companion-list-panel").waitFor();
await page.screenshot({ path: shot("14-companion-list-desktop.png") });
await page.locator(".companion-list article").first().locator(".button-ghost").click();
await page.locator(".companion-detail-panel").waitFor();
await page.screenshot({ path: shot("15-companion-detail-desktop.png") });
await page.locator(".detail-buttons .button-primary").click();
await page.locator(".waiting-panel").waitFor();
await page.screenshot({ path: shot("16-companion-waiting-desktop.png") });
await page.locator(".simulate-accept").click();
await page.locator(".payment-panel").waitFor({ timeout: 5000 });
await page.screenshot({ path: shot("17-companion-payment-desktop.png") });
await page.locator(".payment-actions > .button").click();
await page.locator(".arrived-panel").waitFor();
await page.screenshot({ path: shot("18-companion-arrived-desktop.png") });
await page.locator(".arrived-confirm > .button-primary").click();
await page.waitForTimeout(9_000);
if (!await page.locator(".service-panel").isVisible()) {
  await page.screenshot({ path: shot("debug-arrived-stuck.png") });
  throw new Error(`Companion service did not start: ${await page.locator(".arrived-confirm").innerText()}`);
}
await page.locator(".service-panel").waitFor();
await page.screenshot({ path: shot("19-companion-service-desktop.png") });
await page.locator(".service-actions .button-danger").click();
await page.locator(".finished-panel").waitFor();
await page.screenshot({ path: shot("20-companion-finished-desktop.png") });
await page.locator(".finished-details article").first().locator(".button").click();
await page.locator(".rating-card textarea").fill("流程清楚，服务顺利。");
await page.locator(".rating-card .button").click();
await page.locator(".records-panel").waitFor();

await page.locator(".side-nav button").nth(4).click();
await page.locator(".profile-panel").waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("21-profile-desktop.png") });
await page.locator(".profile-grid button").nth(1).click();
await page.locator(".records-panel").waitFor();
await page.screenshot({ path: shot("22-records-desktop.png") });

await page.setViewportSize({ width: 430, height: 932 });
await page.locator(".bottom-nav button").nth(1).click();
await page.screenshot({ path: shot("03-agent-mobile.png"), fullPage: false });
await page.locator(".chat-composer input").fill("腹泻和呕吐");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await page.screenshot({ path: shot("07-hospitals-mobile.png"), fullPage: false });

console.log(JSON.stringify({ errors, screenshots: 25 }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n\n")}`);
