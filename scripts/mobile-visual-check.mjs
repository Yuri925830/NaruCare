import { chromium } from "playwright-core";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mobileWidth = Number(process.env.MOBILE_WIDTH || 430);
const output = new URL(`../.visual-check/mobile-${mobileWidth}/`, import.meta.url);
await mkdir(output, { recursive: true });
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".png")) await unlink(new URL(entry.name, output));
}
const shot = (name) => fileURLToPath(new URL(name, output));
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const mobileViewport = { width: mobileWidth, height: 932 };
const desktopViewport = { width: 1440, height: 900 };

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: mobileViewport,
  permissions: ["geolocation", "microphone"],
  geolocation: { latitude: 37.5665, longitude: 126.978 },
});
await context.addInitScript(() => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    getCurrentPosition(success) {
      success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 8 }, timestamp: Date.now() });
    },
    watchPosition(success) {
      window.setTimeout(() => success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 8 }, timestamp: Date.now() }), 20);
      return 1;
    },
    clearWatch() {},
  } });
});

const page = await context.newPage();
await page.route("**/api/**", (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path.endsWith("/api/translate")) {
    const payload = JSON.parse(route.request().postData() || "{}");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ translated: payload.text || "" }) });
  }
  return route.abort();
});

const audited = [];
async function auditMobile(name, selector, fullPage = true) {
  await page.setViewportSize(mobileViewport);
  const target = page.locator(selector).filter({ visible: true }).first();
  await target.waitFor({ state: "visible", timeout: 12_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(120);
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  if (geometry.documentWidth > geometry.viewport + 1 || geometry.bodyWidth > geometry.viewport + 1) {
    const overflowers = await page.locator("body *").evaluateAll((elements) => elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return getComputedStyle(element).display !== "none" && rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
      })
      .slice(0, 12)
      .map((element) => ({ tag: element.tagName, className: element.className, width: Math.round(element.getBoundingClientRect().width), scrollWidth: element.scrollWidth })));
    await page.screenshot({ path: shot(`overflow-${name}.png`), fullPage: true });
    throw new Error(`${name}: page horizontally overflows ${JSON.stringify({ ...geometry, overflowers })}`);
  }
  const clippedControls = await target.locator("button, a, input, select, textarea").evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      let ancestor = element.parentElement;
      let intentionallyScrollable = false;
      while (ancestor && ancestor !== document.body) {
        if (/auto|scroll/.test(getComputedStyle(ancestor).overflowX)) { intentionallyScrollable = true; break; }
        ancestor = ancestor.parentElement;
      }
      return !intentionallyScrollable && style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && (rect.left < -1 || rect.right > window.innerWidth + 1);
    })
    .map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent?.trim().slice(0, 40) })));
  if (clippedControls.length) throw new Error(`${name}: controls extend outside the viewport ${JSON.stringify(clippedControls)}`);
  await page.screenshot({ path: shot(`${String(audited.length + 1).padStart(2, "0")}-${name}.png`), fullPage });
  audited.push(name);
}

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".auth-art > .language-button").click();
await auditMobile("auth-language", ".language-page");
await page.locator(".language-list button").filter({ hasText: "中文（简体）" }).click();
await page.locator(".language-continue").click();
await auditMobile("login", ".auth-page");
await page.locator(".auth-switch").click();
await auditMobile("register", ".auth-page");
await page.locator('input[autocomplete="username"]').fill(`mobile-${Date.now().toString(36)}`);
await page.locator('input[autocomplete="new-password"]').nth(0).fill("12345678");
await page.locator('input[autocomplete="new-password"]').nth(1).fill("12345678");
await page.locator('button[type="submit"]').click();
await auditMobile("agent-new-user", ".agent-grid", false);

await page.locator(".bottom-nav button").nth(0).click();
await page.locator(".medical-card-form").waitFor();
await page.locator('[data-field="name"] input').fill("Mobile QA");
await page.locator('[data-field="nationality"] select').selectOption("CN");
await page.locator('[data-field="age"] input').fill("30");
await page.locator('[data-field="documentNumber"] input').fill("90******123");
await page.locator('[data-field="symptoms"] textarea').fill("移动端布局检查");
await auditMobile("medical-card-create", ".medical-card-panel");
await page.locator(".medical-card-form > .button").click();
await page.locator(".agent-grid").filter({ visible: true }).waitFor({ timeout: 15_000 });
await auditMobile("agent", ".agent-grid", false);

// The visit-flow information card must be independently accessible.
await page.locator(".bottom-nav button").nth(2).click();
await auditMobile("visit-flow", ".visit-flow-panel");
const flowPanel = page.locator(".visit-flow-panel").filter({ visible: true });
const [flowWidth, stepWidth] = await Promise.all([
  flowPanel.evaluate((element) => element.clientWidth),
  flowPanel.locator(".flow-steps > div").first().evaluate((element) => element.getBoundingClientRect().width),
]);
if (stepWidth < flowWidth - 2) throw new Error("visit-flow: steps are squeezed instead of using the available width");
if (await flowPanel.locator(".prepare-grid").count()) throw new Error("visit-flow: preparation checklist must live on its own tips card");
const characterStyle = await flowPanel.locator(".naru-pose").first().evaluate((element) => ({
  overflow: getComputedStyle(element).overflow,
  filter: getComputedStyle(element.querySelector("img")).filter,
}));
if (characterStyle.overflow !== "visible" || characterStyle.filter !== "none") throw new Error(`visit-flow: character artwork is clipped into a rectangular shadow ${JSON.stringify(characterStyle)}`);
await flowPanel.locator(".visit-tips-action").click();
await auditMobile("visit-tips", ".visit-tips-panel");
const tipsPanel = page.locator(".visit-tips-panel").filter({ visible: true });
const [tipsWidth, prepWidth] = await Promise.all([
  tipsPanel.evaluate((element) => element.clientWidth),
  tipsPanel.locator(".prepare-grid > label").first().evaluate((element) => element.getBoundingClientRect().width),
]);
if (prepWidth < tipsWidth - 2) throw new Error("visit-tips: cards are squeezed instead of using the available width");

await page.locator(".bottom-nav button").nth(3).click();
await auditMobile("emergency-confirm", ".emergency-confirm-panel", false);
await page.locator(".emergency-copy > .button-danger").click();
await auditMobile("emergency-calling", ".emergency-calling-panel", false);
await page.locator(".bottom-nav button").nth(1).click();

await page.locator(".bottom-nav button").nth(4).click();
await auditMobile("profile", ".profile-panel");
await page.locator(".profile-grid button").nth(1).click();
await auditMobile("records-empty", ".records-panel");
await page.locator(".page-back").click();
await page.locator(".profile-panel").filter({ visible: true }).waitFor();
await page.locator(".profile-grid button").nth(2).click();
await auditMobile("companion-orders-empty", ".orders-panel");
await page.locator(".page-header .language-button").click();
await auditMobile("in-app-language", ".in-app-language", false);
await page.locator(".in-app-language .language-continue").click();

// Desktop-only side navigation opens auxiliary pages; each page is then audited at mobile width.
await page.setViewportSize(desktopViewport);
await page.locator(".side-nav button").nth(2).click();
await page.locator(".hospital-item").first().waitFor({ timeout: 15_000 });
await page.locator(".hospital-item").first().click();
await auditMobile("hospitals", ".hospital-panel");
const hospitalGeometry = await page.locator(".hospital-panel").filter({ visible: true }).evaluate((panel) => {
  const panelRect = panel.getBoundingClientRect();
  const innerRects = [panel.querySelector(".appointment-preference"), panel.querySelector(".map-card"), panel.querySelector(".hospital-list"), panel.querySelector(".hospital-actions")]
    .filter(Boolean)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left - panelRect.left, right: panelRect.right - rect.right };
    });
  return { viewport: window.innerWidth, panelWidth: panelRect.width, innerRects };
});
if (hospitalGeometry.panelWidth < hospitalGeometry.viewport - 20) throw new Error(`hospitals: panel is still visibly narrower than the phone ${JSON.stringify(hospitalGeometry)}`);
if (hospitalGeometry.innerRects.some(({ left, right }) => left < 9 || right < 9)) throw new Error(`hospitals: inner cards touch the panel frame ${JSON.stringify(hospitalGeometry)}`);
const routeButton = page.locator(".hospital-actions .button-mint");
if (await routeButton.isDisabled()) throw new Error("hospitals: route button is disabled after selecting a hospital");
await routeButton.click();
await auditMobile("navigation", ".navigation-panel");
await page.locator(".route-info > .button-secondary").click();
await auditMobile("translation", ".translation-panel");

await page.setViewportSize(desktopViewport);
await page.locator(".side-nav button").nth(5).click();
await auditMobile("companion-notice", ".companion-notice-panel");
await page.locator(".agree-check input").check();
await page.locator(".notice-actions > .button").click();
await auditMobile("companion-filter", ".filter-panel");
await page.locator(".filter-panel > .button").click();
await auditMobile("companion-list", ".companion-list-panel");
await page.locator(".companion-list article").first().locator(".button-primary").click();
await auditMobile("companion-detail", ".companion-detail-panel");
await page.locator(".detail-buttons .button-secondary").click();
await auditMobile("companion-chat", ".companion-chat-panel", false);
await page.locator(".page-back").click();
await page.locator(".companion-detail-panel").filter({ visible: true }).waitFor();
await page.locator(".detail-buttons .button-primary").click();
await auditMobile("companion-waiting", ".waiting-panel");
await page.locator(".simulate-accept").click();
await auditMobile("companion-payment", ".payment-panel");
await page.locator(".payment-actions > .button").click();
await auditMobile("companion-arrived", ".arrived-panel");
await page.locator(".arrived-confirm > .button-primary").click();
await page.locator(".service-panel").waitFor({ timeout: 12_000 });
await auditMobile("companion-service", ".service-panel", false);
await page.locator(".service-actions .button-danger").click();
await page.locator(".service-end-dialog .button-danger").click();
await auditMobile("companion-finished", ".finished-panel");

console.log(JSON.stringify({ audited: audited.length, pages: audited }, null, 2));
await browser.close();
