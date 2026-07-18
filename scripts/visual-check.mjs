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

await page.locator(".chat-composer input").fill("我肚子不舒服");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".gate-modal").waitFor();
await page.screenshot({ path: shot("04-card-gate-desktop.png") });
await page.locator(".gate-modal .button-primary").click();
await page.locator(".medical-card-form").waitFor();
const labels = page.locator(".medical-card-form label");
await labels.nth(0).locator("input").fill("UU");
await labels.nth(1).locator("input").fill("中国");
const addressInput = labels.nth(2).locator("input");
if (await addressInput.getAttribute("required") !== null) throw new Error("Residential address must remain optional");
await addressInput.fill("서울특별시 중구 세종대로 110, 1203호");
await labels.nth(3).locator("input").fill("25");
await labels.nth(6).locator("input").fill("90******123");
await page.screenshot({ path: shot("05-card-desktop.png") });
await page.locator(".medical-card-form > .button").click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("肚子疼，一直拉肚子，还吐了，今天吃了海鲜");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await page.screenshot({ path: shot("07-hospitals-desktop.png") });
await page.locator(".hospital-actions .button-primary").click();
await page.locator(".flow-panel").waitFor();
await page.screenshot({ path: shot("08-flow-desktop.png") });
await page.locator(".flow-panel .align-right .button").click();
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
await page.locator(".payment-panel").waitFor({ timeout: 10000 });
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

await page.locator(".side-nav button").nth(4).click();
await page.locator(".profile-panel").waitFor();
await page.waitForTimeout(300);
await page.screenshot({ path: shot("20-profile-desktop.png") });
await page.locator(".profile-grid button").nth(1).click();
await page.locator(".records-panel").waitFor();
await page.screenshot({ path: shot("21-records-desktop.png") });

await page.setViewportSize({ width: 430, height: 932 });
await page.locator(".bottom-nav button").nth(1).click();
await page.screenshot({ path: shot("03-agent-mobile.png"), fullPage: false });
await page.locator(".chat-composer input").fill("腹泻和呕吐");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await page.screenshot({ path: shot("07-hospitals-mobile.png"), fullPage: false });

console.log(JSON.stringify({ errors, screenshots: 24 }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n\n")}`);
