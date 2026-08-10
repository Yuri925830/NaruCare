import { chromium } from "playwright-core";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mobileWidth = Number(process.env.MOBILE_WIDTH || 430);
const mobileHeight = Number(process.env.MOBILE_HEIGHT || 932);
const output = new URL(`../.visual-check/mobile-${mobileWidth}x${mobileHeight}/`, import.meta.url);
await mkdir(output, { recursive: true });
for (const entry of await readdir(output, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.endsWith(".png")) await unlink(new URL(entry.name, output));
}
const shot = (name) => fileURLToPath(new URL(name, output));
const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:5173/";
const mobileViewport = { width: mobileWidth, height: mobileHeight };
const mobileUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const context = await browser.newContext({
  viewport: mobileViewport,
  screen: mobileViewport,
  userAgent: mobileUserAgent,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
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
  if (path.endsWith("/api/location/reverse")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ address: "서울특별시 중구 세종대로 110" }) });
  }
  if (path.endsWith("/api/maps/config")) {
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ naverMapsClientId: "", dynamicMap: false }) });
  }
  if (path.endsWith("/api/translate")) {
    const payload = JSON.parse(route.request().postData() || "{}");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ translated: payload.text || "" }) });
  }
  return route.abort();
});

const audited = [];
const mobileCanvasSpecs = {
  "auth-language": { shell: ".language-page", cards: ".language-hero, .language-list, .language-continue", gutter: 16 },
  login: { shell: ".auth-page", cards: ".auth-form", gutter: 20 },
  register: { shell: ".auth-page", cards: ".auth-form", gutter: 20 },
  "agent-new-user": { shell: ".chat-panel", cards: ":scope > .agent-online, :scope > .messages, :scope > .chat-composer" },
  "agent-card-address": { shell: ".chat-panel", cards: ":scope > .agent-online, :scope > .messages, :scope > .chat-composer" },
  "medical-card-create": { shell: ".medical-card-panel", cards: ":scope > .info-banner, .medical-card-form > label, .medical-card-form > .button" },
  agent: { shell: ".chat-panel", cards: ":scope > .agent-online, :scope > .messages, :scope > .chat-composer" },
  "visit-flow": { shell: ".visit-flow-panel", cards: ":scope > .info-banner, :scope > .visit-flow-toolbar, .flow-steps > div" },
  "visit-tips": { shell: ".visit-tips-panel", cards: ":scope > .info-banner, .prepare-grid > label, .visit-tips-flow .flow-steps > div, :scope > .flow-choice-actions" },
  "emergency-confirm": { shell: ".emergency-confirm-panel", cards: ":scope > .emergency-illustration, :scope > .emergency-copy" },
  "emergency-calling": { shell: ".emergency-calling-panel", cards: ":scope > .call-left, :scope > .call-script" },
  profile: { shell: ".profile-panel", cards: ":scope > .profile-hero, .profile-grid > button, .profile-footer > .info-banner, .profile-footer > .button" },
  "records-empty": { shell: ".records-panel", cards: ":scope > .info-banner, :scope > .empty-records, .records-list > article" },
  "companion-orders-empty": { shell: ".orders-panel", cards: ":scope > .info-banner, :scope > .empty-records, .orders-list > article" },
  "in-app-language": { shell: ".in-app-language", cards: ".language-list, .language-continue" },
  hospitals: { shell: ".hospital-panel", cards: ":scope > .info-banner, :scope > .appointment-preference, .hospital-layout > .map-card, .hospital-layout > .hospital-list, :scope > .hospital-actions" },
  navigation: { shell: ".navigation-panel", cards: ":scope > .travel-tabs, :scope > .navigation-layout" },
  translation: { shell: ".translation-panel", cards: ":scope > .translation-language-picker, :scope > .translation-direction, :scope > .translation-conversation, :scope > .translation-composer" },
  "companion-notice": { shell: ".companion-notice-panel", cards: ":scope > .info-banner, .notice-grid > article, .notice-actions > .agree-check, .notice-actions > .button" },
  "companion-filter": { shell: ".filter-panel", cards: ".filter-grid > label, :scope > .button" },
  "companion-list": { shell: ".companion-list-panel", cards: ":scope > .info-banner, .companion-list > article, :scope > .list-footer" },
  "companion-detail": { shell: ".companion-detail-panel", cards: ":scope > .detail-profile, :scope > .detail-info" },
  "companion-chat": { shell: ".companion-chat-panel", cards: ":scope > .chat-person, :scope > .messages, :scope > .chat-composer" },
  "companion-waiting": { shell: ".waiting-panel", cards: ":scope > .waiting-clock, :scope > .waiting-info, .waiting-contact > .button:only-child" },
  "companion-payment": { shell: ".payment-panel", cards: ":scope > .info-banner, .payment-grid > article, :scope > .payment-actions" },
  "companion-arrived": { shell: ".arrived-panel", cards: ":scope > .arrived-profile, :scope > .arrived-confirm" },
  "companion-service": { shell: ".service-panel", cards: ":scope > .service-person, :scope > .service-main" },
  "companion-finished": { shell: ".finished-panel", cards: ":scope > .finished-success, :scope > .finished-details" },
};

async function assertMobileCanvas(name) {
  const spec = mobileCanvasSpecs[name];
  if (!spec) throw new Error(`${name}: missing an explicit mobile canvas regression spec`);
  const shell = page.locator(spec.shell).filter({ visible: true }).first();
  await shell.waitFor({ state: "visible", timeout: 12_000 });
  const geometry = await shell.evaluate((element, { cards, gutter }) => {
    const shellRect = element.getBoundingClientRect();
    const expectedGutter = gutter ?? (innerWidth <= 390 ? 12 : 16);
    const cardRects = [...element.querySelectorAll(cards)]
      .filter((card) => {
        const rect = card.getBoundingClientRect();
        const style = getComputedStyle(card);
        return rect.width > 0 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          className: typeof card.className === "string" ? card.className : card.tagName,
          left: rect.left - shellRect.left,
          right: shellRect.right - rect.right,
          viewportLeft: rect.left,
          viewportRight: innerWidth - rect.right,
        };
      });
    const style = getComputedStyle(element);
    return {
      viewport: innerWidth,
      expectedGutter,
      shell: {
        left: shellRect.left,
        right: innerWidth - shellRect.right,
        width: shellRect.width,
        paddingLeft: parseFloat(style.paddingLeft) || 0,
        paddingRight: parseFloat(style.paddingRight) || 0,
      },
      cards: cardRects,
    };
  }, spec);
  const tolerance = 1.5;
  if (Math.abs(geometry.shell.left) > tolerance
    || Math.abs(geometry.shell.right) > tolerance
    || Math.abs(geometry.shell.width - geometry.viewport) > tolerance) {
    throw new Error(`${name}: outer mobile canvas does not fill the phone ${JSON.stringify(geometry)}`);
  }
  if (!geometry.cards.length) throw new Error(`${name}: no visible cards were covered by the mobile gutter assertion`);
  const invalid = geometry.cards.filter((card) => Math.abs(card.left - geometry.expectedGutter) > tolerance
    || Math.abs(card.right - geometry.expectedGutter) > tolerance
    || Math.abs(card.left - card.right) > tolerance);
  if (invalid.length) {
    throw new Error(`${name}: cards do not keep the ${geometry.expectedGutter}px phone gutter ${JSON.stringify({ ...geometry, invalid })}`);
  }
}

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
  await assertMobileCanvas(name);
  const headerLanguage = page.locator(".page-header .language-button").filter({ visible: true });
  if (await headerLanguage.count()) {
    const headerLanguageGeometry = await headerLanguage.first().evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const icon = button.querySelector("svg")?.getBoundingClientRect();
      const label = button.querySelector("span")?.getBoundingClientRect();
      return {
        text: button.textContent?.trim(),
        width: rect.width,
        iconWidth: icon?.width || 0,
        labelWidth: label?.width || 0,
      };
    });
    if (headerLanguageGeometry.width < 100 || headerLanguageGeometry.iconWidth < 14 || headerLanguageGeometry.labelWidth < 36) {
      throw new Error(`${name}: header language control collapsed on mobile ${JSON.stringify(headerLanguageGeometry)}`);
    }
  }
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

// The Agent medical-card wizard must let users revisit prior answers and
// make automatic location + map confirmation unmistakable at the address step.
await page.locator(".prompt-suggestions button").nth(1).click();
const wizard = page.locator(".medical-card-chat").filter({ visible: true });
const wizardProgress = wizard.locator(".medical-card-chat-progress");
const composerInput = page.locator(".chat-composer input");
const composerSubmit = page.locator(".chat-composer button");
const waitWizardStep = (step) => page.waitForFunction((expected) => document.querySelector(".medical-card-chat-progress")?.getAttribute("aria-valuenow") === String(expected), step);
await wizard.waitFor();
if (await wizard.locator(".medical-card-chat-back").count()) throw new Error("medical-card wizard: first step must not show a previous-step action");
await composerInput.fill("Mobile Agent QA");
await composerSubmit.click();
await waitWizardStep(2);
await composerInput.fill("CN");
await composerSubmit.click();
await waitWizardStep(3);
await wizard.locator(".medical-card-chat-back").click();
await waitWizardStep(2);
if (await wizardProgress.getAttribute("aria-valuenow") !== "2" || await composerInput.inputValue() !== "CN") {
  throw new Error("medical-card wizard: back did not restore the previous text answer");
}
await composerSubmit.click();
await waitWizardStep(3);
await composerInput.fill("30");
await composerSubmit.click();
await waitWizardStep(4);
await wizard.locator(".medical-card-chat-options button").first().click();
await waitWizardStep(5);
const selectedLanguage = wizard.locator(".medical-card-chat-options button.selected");
if (await selectedLanguage.count() !== 1) throw new Error("medical-card wizard: the previously selected language is not highlighted");
await selectedLanguage.click();
await waitWizardStep(6);
await wizard.locator(".medical-card-chat-options button").first().click();
await waitWizardStep(7);
await composerInput.fill("901010-1234567");
await composerSubmit.click();
await waitWizardStep(8);
await wizard.locator(".medical-card-chat-options button").first().click();
await waitWizardStep(9);
const addressLocation = wizard.locator(".medical-card-chat-location");
await addressLocation.waitFor();
await addressLocation.locator(".medical-card-chat-locate").click();
await page.waitForFunction(() => {
  const button = document.querySelector(".medical-card-chat-locate");
  const input = document.querySelector(".chat-composer input");
  return button && !button.hasAttribute("disabled") && input instanceof HTMLInputElement && input.value.trim().length > 0;
});
await addressLocation.locator(".medical-card-chat-map .interactive-map").waitFor();
const addressGeometry = await addressLocation.evaluate((element) => {
  const card = element.getBoundingClientRect();
  const map = element.querySelector(".medical-card-chat-map")?.getBoundingClientRect();
  const locate = element.querySelector(".medical-card-chat-locate")?.getBoundingClientRect();
  return { card: { left: card.left, right: card.right, width: card.width }, map: map && { left: map.left, right: map.right, width: map.width }, locate: locate && { left: locate.left, right: locate.right, width: locate.width } };
});
if (!addressGeometry.map || !addressGeometry.locate
  || addressGeometry.map.left < addressGeometry.card.left - 1 || addressGeometry.map.right > addressGeometry.card.right + 1
  || addressGeometry.locate.left < addressGeometry.card.left - 1 || addressGeometry.locate.right > addressGeometry.card.right + 1) {
  throw new Error(`medical-card wizard: location UI overflows on mobile ${JSON.stringify(addressGeometry)}`);
}
await auditMobile("agent-card-address", ".medical-card-chat", false);
await wizard.locator(".medical-card-chat-back").click();
await waitWizardStep(8);
if (await wizardProgress.getAttribute("aria-valuenow") !== "8" || await wizard.locator(".medical-card-chat-options button.selected").count() !== 1) {
  throw new Error("medical-card wizard: the previous structured answer was not retained");
}
await wizard.locator(".medical-card-chat-options button.selected").click();
await waitWizardStep(9);
if (!(await composerInput.inputValue()).trim()) throw new Error("medical-card wizard: the located address was not retained after returning");
await wizard.locator(".medical-card-chat-actions .button").last().click();

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
const mobileNavCount = await page.locator(".bottom-nav button").count();
if (mobileNavCount !== 6) throw new Error(`mobile navigation: expected 6 independent entries, received ${mobileNavCount}`);
await page.locator(".bottom-nav button").nth(2).click();
await auditMobile("visit-flow", ".visit-flow-panel");
const flowPanel = page.locator(".visit-flow-panel").filter({ visible: true });
if (await flowPanel.locator(".prepare-grid").count()) throw new Error("visit-flow: preparation checklist must live on its own tips card");
const characterStyle = await flowPanel.locator(".naru-pose").first().evaluate((element) => ({
  overflow: getComputedStyle(element).overflow,
  filter: getComputedStyle(element.querySelector("img")).filter,
}));
if (characterStyle.overflow !== "visible" || characterStyle.filter !== "none") throw new Error(`visit-flow: character artwork is clipped into a rectangular shadow ${JSON.stringify(characterStyle)}`);
const [toolbarWidth, tipsActionWidth] = await Promise.all([
  flowPanel.locator(".visit-flow-toolbar").evaluate((element) => element.getBoundingClientRect().width),
  flowPanel.locator(".visit-tips-action").evaluate((element) => element.getBoundingClientRect().width),
]);
if (tipsActionWidth < toolbarWidth - 2) throw new Error(`visit-flow: tips action is not full width ${JSON.stringify({ toolbarWidth, tipsActionWidth })}`);
await page.locator(".bottom-nav button").nth(3).click();
await auditMobile("visit-tips", ".visit-tips-panel");
const tipsPanel = page.locator(".visit-tips-panel").filter({ visible: true });
const tipsStepCount = await tipsPanel.locator(".flow-steps > div").count();
if (tipsStepCount !== 5) throw new Error(`visit-tips: expected 5 after-arrival steps, received ${tipsStepCount}`);

await page.locator(".bottom-nav button").nth(4).click();
await auditMobile("emergency-confirm", ".emergency-confirm-panel", false);
await page.locator(".emergency-copy > .button-danger").click();
await auditMobile("emergency-calling", ".emergency-calling-panel", false);
await page.locator(".bottom-nav button").nth(1).click();

await page.locator(".bottom-nav button").nth(5).click();
await auditMobile("profile", ".profile-panel");
const profileFooterGeometry = await page.locator(".profile-panel").filter({ visible: true }).evaluate((panel) => {
  const reference = panel.querySelector(".profile-grid > button")?.getBoundingClientRect();
  const privacy = panel.querySelector(".profile-footer > .info-banner")?.getBoundingClientRect();
  const logout = panel.querySelector(".profile-footer > .button")?.getBoundingClientRect();
  return {
    reference: reference ? { left: reference.left, right: reference.right, width: reference.width } : null,
    privacy: privacy ? { left: privacy.left, right: privacy.right, width: privacy.width } : null,
    logout: logout ? { left: logout.left, right: logout.right, width: logout.width } : null,
  };
});
const { reference, privacy, logout } = profileFooterGeometry;
if (!reference || !privacy || !logout
  || Math.abs(privacy.width - logout.width) > 1
  || Math.abs(privacy.left - reference.left) > 1
  || Math.abs(privacy.right - reference.right) > 1
  || Math.abs(logout.left - reference.left) > 1
  || Math.abs(logout.right - reference.right) > 1) {
  throw new Error(`profile: privacy promise and logout are shorter than the service cards ${JSON.stringify(profileFooterGeometry)}`);
}
await page.locator(".profile-grid button").nth(1).click();
await auditMobile("records-empty", ".records-panel");
await page.locator(".page-back").click();
await page.locator(".profile-panel").filter({ visible: true }).waitFor();
await page.locator(".profile-grid button").nth(2).click();
await auditMobile("companion-orders-empty", ".orders-panel");
await page.locator(".page-header .language-button").click();
await auditMobile("in-app-language", ".in-app-language", false);
await page.locator(".in-app-language .language-continue").click();

// Dispatch the hidden side-navigation action without leaving mobile/touch mode.
await page.locator(".side-nav button").nth(2).evaluate((button) => button.click());
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
if (hospitalGeometry.panelWidth < hospitalGeometry.viewport - 1) throw new Error(`hospitals: panel is still visibly narrower than the phone ${JSON.stringify(hospitalGeometry)}`);
const hospitalGutter = hospitalGeometry.viewport <= 390 ? 12 : 16;
if (hospitalGeometry.innerRects.some(({ left, right }) => left < hospitalGutter - 1 || right < hospitalGutter - 1 || Math.abs(left - right) > 1.5)) {
  throw new Error(`hospitals: inner cards touch the panel frame ${JSON.stringify({ ...hospitalGeometry, hospitalGutter })}`);
}
const routeButton = page.locator(".hospital-actions .button-mint");
if (await routeButton.isDisabled()) throw new Error("hospitals: route button is disabled after selecting a hospital");
await routeButton.click();
await auditMobile("navigation", ".navigation-panel");
await page.locator(".route-info > .button-secondary").click();
await auditMobile("translation", ".translation-panel");

await page.locator(".side-nav button").nth(5).evaluate((button) => button.click());
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
