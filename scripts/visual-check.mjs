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
  let locationWatchId = 0;
  const locationTimers = new Map();
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: {
    watchPosition(success) {
      const id = ++locationWatchId;
      const timers = [
        window.setTimeout(() => success({ coords: { latitude: 37.5665, longitude: 126.978, accuracy: 14 }, timestamp: Date.now() }), 20),
        window.setTimeout(() => success({ coords: { latitude: 37.56651, longitude: 126.97801, accuracy: 6 }, timestamp: Date.now() }), 120),
        window.setTimeout(() => success({ coords: { latitude: 37.56652, longitude: 126.97802, accuracy: 5 }, timestamp: Date.now() }), 180),
      ];
      locationTimers.set(id, timers);
      return id;
    },
    clearWatch(id) { (locationTimers.get(id) || []).forEach((timer) => window.clearTimeout(timer)); locationTimers.delete(id); },
    getCurrentPosition(success) { success({ coords: { latitude: 37.56651, longitude: 126.97801, accuracy: 6 }, timestamp: Date.now() }); },
  } });
  window.__speechEvents = [];
  class MockUtterance {
    constructor(text) { this.text = text; this.lang = ""; this.rate = 1; this.volume = 1; this.onend = null; }
  }
  Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: MockUtterance });
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    cancel() { window.__speechEvents.push("cancel"); },
    speak(utterance) {
      window.__speechEvents.push(`speak:${utterance.lang}:${utterance.text}`);
      window.setTimeout(() => utterance.onend?.(), 35);
    },
  } });
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
const hospitalRequestUrls = [];
async function assertChatDocked(label) {
  const panel = await page.locator(".chat-panel").boundingBox();
  const composer = await page.locator(".chat-composer").boundingBox();
  const viewport = page.viewportSize();
  const overflowY = await page.locator(".messages").evaluate((element) => getComputedStyle(element).overflowY);
  if (!panel || !composer || !viewport) throw new Error(`${label}: chat geometry is unavailable`);
  if (composer.y + composer.height > panel.y + panel.height + 1 || panel.y + panel.height > viewport.height + 1) throw new Error(`${label}: composer is not docked inside the fixed chat panel`);
  if (!/auto|scroll/.test(overflowY)) throw new Error(`${label}: messages are not independently scrollable`);
  if (viewport.width <= 760) {
    const nav = await page.locator(".bottom-nav").boundingBox();
    if (!nav || composer.y + composer.height > nav.y - 4) throw new Error(`${label}: composer overlaps the mobile bottom navigation`);
  }
}
async function assertUniversalWelcome(label, expectAtTop = true) {
  const welcome = page.locator(".message-naru").first();
  const text = await welcome.innerText();
  for (const expected of [
    "Hi，我是 Naru，您的 AI 医疗就诊助手！",
    "就诊信息管理",
    "身体状况初步判断",
    "紧急情况处理",
    "韩国医院就诊指南",
    "附近医院推荐",
    "中韩医疗沟通翻译",
    "真人陪诊服务",
    "您现在感觉哪里不舒服？",
  ]) if (!text.includes(expected)) throw new Error(`${label}: universal welcome is missing ${expected}`);
  if (text.includes("##") || text.includes("**")) throw new Error(`${label}: welcome markdown was rendered as literal text`);
  if (await welcome.locator(".welcome-message h2").count() !== 2 || await welcome.locator(".welcome-message h3").count() !== 7) {
    throw new Error(`${label}: welcome hierarchy was not rendered as structured rich text`);
  }
  if (expectAtTop && await page.locator(".messages").evaluate((element) => element.scrollTop) > 2) throw new Error(`${label}: the long welcome opened at the bottom instead of its first line`);
}
page.on("pageerror", (error) => errors.push(error.stack || error.message));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("ERR_FAILED")) errors.push(message.text()); });
page.on("request", (request) => { if (request.url().includes("/api/hospitals?")) hospitalRequestUrls.push(request.url()); });
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
await assertUniversalWelcome("new desktop account");
await assertChatDocked("desktop");

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
await assertChatDocked("mobile");
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
await page.setViewportSize({ width: 430, height: 932 });
await page.locator('[data-field="address"] .location-picker').scrollIntoViewIfNeeded();
const pickerBox = await page.locator('[data-field="address"] .location-picker').boundingBox();
if (!pickerBox || pickerBox.width > 410 || pickerBox.height < 180) throw new Error("Mobile medical-card location picker is not usable");
await page.screenshot({ path: shot("05-card-mobile.png"), fullPage: true });
await page.setViewportSize({ width: 1440, height: 900 });
await page.locator(".medical-card-form > .button").click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("你是谁？");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
const identityReply = await page.locator(".message-naru").last().innerText();
if (!/我是 Naru/.test(identityReply)) throw new Error("Naru did not answer the identity question directly");
if (!/[💙🌿🩺😊]/u.test(identityReply)) throw new Error("Naru's ordinary conversation did not use a warm emoji tone");
const messageCountBeforeEducation = await page.locator(".message-naru").count();
await page.locator(".chat-composer input").fill("失眠吃安眠药可以根治吗");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").nth(messageCountBeforeEducation).waitFor();
if (!/科普一般医学知识/.test(await page.locator(".message-naru").last().innerText())) throw new Error("A medical knowledge question did not remain in the conversation");
if (await page.locator(".hospital-panel,.emergency-confirm-panel").count()) throw new Error("A medical knowledge question incorrectly launched a care action");
await page.locator(".chat-composer input").fill("就发高烧，看不见东西");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".emergency-confirm-panel").waitFor({ timeout: 3000 });
await page.screenshot({ path: shot("06-triage-emergency-desktop.png") });
await page.locator(".page-back").click();
await page.locator(".agent-grid").waitFor();
// An unresolved red flag intentionally remains active within the same chat.
// Reload here to start an independent visit scenario for the hospital path.
await page.reload({ waitUntil: "networkidle" });
await page.locator(".agent-grid").waitFor();
await assertUniversalWelcome("saved-card account after reload", false);
if (!/你是谁/.test(await page.locator(".messages").innerText())) throw new Error("The active conversation was not restored after reload");
const hospitalRequestCount = hospitalRequestUrls.length;
await page.locator(".chat-composer input").fill("附近医院");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5_000 });
const genericHospitalRequest = hospitalRequestUrls.slice(hospitalRequestCount).at(-1);
if (!genericHospitalRequest || new URL(genericHospitalRequest).searchParams.get("symptom") !== "") throw new Error("A context-free nearby-hospital request reused or invented symptoms");
await page.locator(".page-back").click();
await page.locator(".agent-grid").waitFor();
await page.locator(".side-nav button").first().click();
await page.locator(".medical-card-form").waitFor();
const symptomsAfterGenericHospitalRequest = await page.locator('[data-field="symptoms"] textarea').inputValue();
if (/附近医院/.test(symptomsAfterGenericHospitalRequest)) throw new Error("The nearby-hospital command was written into the medical-card symptom field");
if (!/高烧.*看不见/.test(symptomsAfterGenericHospitalRequest)) throw new Error("A generic hospital command erased the last genuinely reported symptoms");
if (!await page.locator('[data-field="symptoms"] textarea').isDisabled()) throw new Error("Opening a saved card triggered edit mode without an explicit user action");
await page.locator(".side-nav button").nth(1).click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("我刚刚吃了个蛋糕，肚子有点疼");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").filter({ hasText: "要不要去附近医院" }).waitFor({ timeout: 3000 });
if (await page.locator(".hospital-panel:visible").count()) throw new Error("A mild symptom report opened hospitals before the user consented");
await page.locator(".chat-composer input").fill("我又没事了");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").filter({ hasText: "更新为“无”" }).waitFor({ timeout: 3000 });
if (await page.locator(".hospital-panel:visible").count()) throw new Error("A recovery update did not cancel the pending hospital search");
await page.locator(".side-nav button").first().click();
await page.locator(".medical-card-form").waitFor();
if (await page.locator('[data-field="symptoms"] textarea').inputValue() !== "无") throw new Error("A recovery update did not clear the user-language medical-card symptoms");
if (!/없음/.test(await page.locator('[data-field="symptoms"] .korean-preview').innerText())) throw new Error("A recovery update did not clear the Korean medical-card symptoms");
if (!await page.locator('[data-field="symptoms"] textarea').isDisabled()) throw new Error("The recovery update unexpectedly put the saved medical card into edit mode");
await page.locator(".side-nav button").nth(1).click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("OK");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.waitForTimeout(250);
if (await page.locator(".hospital-panel:visible").count()) throw new Error("Consent after a recovery update reused a canceled hospital-search request");
await page.locator(".chat-composer input").fill("我刚刚吃了个蛋糕，肚子有点疼");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").filter({ hasText: "要不要去附近医院" }).last().waitFor({ timeout: 3000 });
await page.locator(".chat-composer input").fill("OK");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.locator(".hospital-item").first().waitFor({ timeout: 12_000 });
await page.locator(".side-nav button").first().click();
await page.locator(".medical-card-form").waitFor();
if (!/编辑/.test(await page.locator(".medical-card-form > .button").innerText())) throw new Error("A saved medical card did not switch its primary action to Edit");
if (!await page.locator('[data-field="address"] textarea').isDisabled()) throw new Error("A saved medical card was not in read-only mode before Edit");
if (!/蛋糕.*肚子有点疼/.test(await page.locator('[data-field="symptoms"] textarea').inputValue())) throw new Error("The organized chat symptom report was not written back to the medical card before consent");
if (!/중국/.test(await page.locator('[data-field="nationality"] .korean-preview').innerText())) throw new Error("Nationality was not translated into Korean on the bilingual card");
await page.setViewportSize({ width: 430, height: 932 });
const editAction = page.locator(".medical-card-form > .button");
await editAction.scrollIntoViewIfNeeded();
await editAction.click();
try {
  await page.waitForFunction(() => !document.querySelector('[data-field="address"] textarea')?.disabled, undefined, { timeout: 2_000 });
} catch {
  const editBox = await editAction.boundingBox();
  const state = editBox ? await page.evaluate(({ x, y, width, height }) => {
    const target = document.elementFromPoint(x + width / 2, y + height / 2);
    return { target: target ? `${target.tagName}.${target.className}` : "none", text: target?.textContent, scrollY, disabled: document.querySelector('[data-field="address"] textarea')?.disabled };
  }, editBox) : { target: "no-box" };
  throw new Error(`The saved medical-card Edit button did not enter edit mode: ${JSON.stringify(state)}`);
}
const locateAction = page.locator('[data-field="address"] .locate-address');
await locateAction.scrollIntoViewIfNeeded();
await locateAction.click();
await page.waitForFunction(() => /^37\.5665\d, 126\.9780\d$/.test(document.querySelector('[data-field="address"] textarea')?.value || ""));
const addressBeforeMapDrag = await page.locator('[data-field="address"] textarea').inputValue();
const locationPicker = page.locator('[data-field="address"] .location-picker');
await locationPicker.scrollIntoViewIfNeeded();
await page.waitForTimeout(350);
const editableMap = locationPicker.locator(".location-picker-map");
await editableMap.waitFor();
await page.waitForFunction(() => {
  const map = document.querySelector('[data-field="address"] .location-picker-map');
  return map?.classList.contains("leaflet-container") || Boolean(map?.querySelector("canvas, .leaflet-map-pane"));
});
const editablePicker = await editableMap.boundingBox();
if (!editablePicker) throw new Error("Editable location picker was not rendered");
const dragStart = { x: editablePicker.x + editablePicker.width * .72, y: editablePicker.y + editablePicker.height * .46 };
const mapTransformBefore = await editableMap.locator(".leaflet-map-pane").getAttribute("style");
await page.mouse.move(dragStart.x, dragStart.y);
await page.mouse.down();
await page.mouse.move(dragStart.x + 65, dragStart.y + 38, { steps: 12 });
await page.mouse.up();
try {
  await page.waitForFunction((previous) => document.querySelector('[data-field="address"] textarea')?.value !== previous, addressBeforeMapDrag, { timeout: 5_000 });
} catch {
  const state = await page.evaluate(({ x, y }) => ({
    address: document.querySelector('[data-field="address"] textarea')?.value,
    hitTarget: (() => { const target = document.elementFromPoint(x, y); return target ? `${target.tagName}.${target.className}` : "none"; })(),
    pickerClass: document.querySelector('[data-field="address"] .location-picker-map')?.className,
    transform: document.querySelector('[data-field="address"] .leaflet-map-pane')?.getAttribute("style"),
  }), dragStart);
  throw new Error(`Dragging the medical-card map did not update the address: ${JSON.stringify({ mapTransformBefore, ...state })}`);
}
await page.setViewportSize({ width: 1440, height: 900 });
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
const destinationAddress = page.locator(".destination-address strong");
if (!(await destinationAddress.innerText()).trim()) throw new Error("Navigation destination does not show the hospital's concrete address");
if (await page.locator(".map-app-links .lucide-map").count() !== 3) throw new Error("The three map apps do not use one consistent map icon");
if (await page.locator(".taxi-app-links .lucide-car-front").count() !== 2) throw new Error("The two taxi apps do not use one consistent car icon");
await page.locator(".destination-address .button").click();
if (!/已复制/.test(await page.locator(".destination-address .button").innerText())) throw new Error("One-click hospital address copy did not provide confirmation");
await page.screenshot({ path: shot("09-navigation-desktop.png") });

await page.locator(".route-info > button.button-secondary").click();
await page.locator(".translation-panel").waitFor();
await page.waitForTimeout(300);
await page.locator(".translation-composer textarea").fill("我的肚子很痛，需要告诉医院人员");
await page.locator(".translation-composer").evaluate((form) => form.requestSubmit());
await page.waitForTimeout(120);
await page.locator(".mic-button").click();
await page.waitForTimeout(100);
const voiceLanguage = await page.evaluate(() => window.__voiceRecognitionStarted || "");
if (!voiceLanguage) throw new Error("Browser speech recognition did not start");
await page.screenshot({ path: shot("10-translation-desktop.png") });
await page.locator(".translation-finish .button").click();
await page.locator(".agent-grid").waitFor();
if (await page.locator(".messages .message").count() !== 1) throw new Error("Completed visit did not reset the Naru conversation");
await page.locator(".side-nav button").first().click();
await page.locator(".medical-card-form").waitFor();
if (await page.locator('[data-field="symptoms"] textarea').inputValue() !== "") throw new Error("Completed visit symptoms were not cleared from temporary medical-card state");
await page.locator(".page-back").click();
await page.locator(".agent-grid").waitFor();
await page.locator(".chat-composer input").fill("肚子疼，一直拉肚子，还吐了，今天吃了海鲜");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").filter({ hasText: "要不要去附近医院" }).waitFor({ timeout: 3000 });
await page.locator(".chat-composer input").fill("好的");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.locator(".hospital-item").first().waitFor({ timeout: 12_000 });

await page.locator(".side-nav button").nth(3).click();
await page.locator(".emergency-confirm-panel").waitFor();
await page.waitForTimeout(300);
const emergencyPose = await page.locator(".emergency-confirm-naru img").getAttribute("src");
if (!emergencyPose?.includes("pose-09.png")) throw new Error("Emergency confirmation must use the worried Naru pose");
const emergencyIconBox = await page.locator(".emergency-illustration > div").boundingBox();
const emergencyNaruBox = await page.locator(".emergency-confirm-naru").boundingBox();
if (!emergencyIconBox || !emergencyNaruBox || !(emergencyIconBox.y + emergencyIconBox.height <= emergencyNaruBox.y + 2)) throw new Error("Emergency Naru overlaps the red alert icon");
await page.screenshot({ path: shot("11-emergency-desktop.png") });
await page.locator(".emergency-copy > .button-danger").click();
await page.locator(".emergency-calling-panel").waitFor();
await page.waitForTimeout(150);
const emergencyTextColor = await page.locator(".call-script article p").first().evaluate((element) => getComputedStyle(element).color);
if (/rgb\(255,\s*255,\s*255\)/.test(emergencyTextColor)) throw new Error("Emergency call content still inherits unreadable white text");
await page.locator(".call-script article .button-danger").click();
await page.waitForTimeout(100);
const speechBeforeExit = await page.evaluate(() => window.__speechEvents.filter((event) => event.startsWith("speak:")).length);
if (!speechBeforeExit) throw new Error("Korean 119 broadcast did not start");
await page.screenshot({ path: shot("11-emergency-calling-desktop.png") });
await page.locator(".page-back").click();
await page.locator(".emergency-confirm-panel").waitFor();
await page.locator(".emergency-copy > .button-ghost").click();
await page.locator(".hospital-panel").waitFor();
await page.locator(".hospital-item").first().waitFor({ timeout: 12_000 });
await page.waitForTimeout(900);
const speechAfterDecline = await page.evaluate(() => window.__speechEvents.filter((event) => event.startsWith("speak:")).length);
if (speechAfterDecline !== speechBeforeExit) throw new Error("Korean 119 broadcast continued after leaving emergency mode");

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
await page.locator(".page-back").click();
await page.locator(".companion-list-panel").waitFor();
await page.locator(".companion-list article").first().locator(".button-primary").click();
await page.locator(".companion-detail-panel").waitFor();
await page.locator(".page-back").click();
await page.locator(".companion-list-panel").waitFor();
await page.locator(".companion-list article").first().locator(".button-primary").click();
await page.locator(".companion-detail-panel").waitFor();
const applyAfterReturns = page.locator(".detail-buttons .button-primary");
if (await applyAfterReturns.isDisabled() || /加载中/.test(await applyAfterReturns.innerText())) throw new Error("Companion apply button remained stuck after repeated back/forward navigation");
await page.locator(".duration-selector select").selectOption("90");
if (await page.locator(".duration-selector select").inputValue() !== "90") throw new Error("Companion duration did not accept a 1.5-hour selection");
await page.setViewportSize({ width: 430, height: 932 });
await page.locator(".detail-buttons .button-secondary").click();
await page.locator(".companion-chat-panel").waitFor();
const recordingBadgeColor = await page.locator(".chat-person .status-navy").evaluate((element) => getComputedStyle(element).color);
if (/rgb\(255,\s*255,\s*255\)/.test(recordingBadgeColor)) throw new Error("Companion chat recording badge still has unreadable white text");
await page.screenshot({ path: shot("15-companion-chat-mobile.png"), fullPage: false });
await page.locator(".page-back").click();
await page.locator(".companion-detail-panel").waitFor();
await page.setViewportSize({ width: 1440, height: 900 });
await page.locator(".detail-buttons .button-primary").click();
await page.locator(".waiting-panel").waitFor();
await page.screenshot({ path: shot("16-companion-waiting-desktop.png") });
await page.locator(".simulate-accept").click();
await page.locator(".payment-panel").waitFor({ timeout: 5000 });
if (!/1.5\s*小时/.test(await page.locator(".payment-grid").innerText())) throw new Error("The selected 1.5-hour duration was not carried into billing");
await page.screenshot({ path: shot("17-companion-payment-desktop.png") });
await page.locator(".payment-actions > .button").click();
await page.locator(".arrived-panel").waitFor();
await page.screenshot({ path: shot("18-companion-arrived-desktop.png") });
await page.locator(".arrived-confirm > .button-primary").click();
await page.waitForTimeout(700);
if (!await page.locator(".service-panel").isVisible()) {
  await page.screenshot({ path: shot("debug-arrived-stuck.png") });
  throw new Error(`Companion service did not start: ${await page.locator(".arrived-confirm").innerText()}`);
}
await page.locator(".service-panel").waitFor();
const serviceTextColor = await page.locator(".service-time").evaluate((element) => getComputedStyle(element).color);
if (/rgb\(255,\s*255,\s*255\)/.test(serviceTextColor)) throw new Error("Companion service content still inherits unreadable white text");
await page.screenshot({ path: shot("19-companion-service-desktop.png") });
const remainingBeforeExtension = await page.locator(".service-time").innerText();
await page.locator(".service-actions .button-secondary").click();
const remainingAfterExtension = await page.locator(".service-time").innerText();
if (remainingBeforeExtension === remainingAfterExtension) throw new Error("Extending companion service by 30 minutes did not update the timer");
for (let index = 0; index < 20; index += 1) await page.locator(".service-actions .button-secondary").click();
if (!await page.locator(".service-actions .button-secondary").isDisabled()) throw new Error("Companion service could still be extended beyond the 12-hour maximum");
if (!/12 小时上限/.test(await page.locator(".service-maximum").innerText())) throw new Error("The 12-hour companion-service limit was not explained to the user");
const remainingAtMaximum = await page.locator(".service-time").innerText();
await page.locator(".service-actions .button-secondary").evaluate((button) => button.click());
await page.waitForTimeout(50);
if (await page.locator(".service-time").innerText() !== remainingAtMaximum) throw new Error("A disabled extension action changed the timer beyond 12 hours");
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
await page.locator(".profile-grid button").nth(2).click();
await page.locator(".orders-panel").waitFor();
if (!await page.locator(".orders-list article").count()) throw new Error("Companion orders page did not load the created order");
await page.locator(".order-manage-actions .button-ghost").first().click();
await page.locator(".delete-record-dialog").waitFor();
if (!/安全录音/.test(await page.locator(".delete-record-dialog").innerText())) throw new Error("Companion order deletion did not warn about linked safety recordings");
await page.locator(".delete-record-dialog .button-danger").click();
await page.locator(".empty-records").waitFor();
if (await page.locator(".orders-list article").count()) throw new Error("The selected companion order was not deleted");
await page.locator(".page-back").click();
await page.locator(".profile-panel").waitFor();
await page.locator(".profile-grid button").nth(1).click();
await page.locator(".records-panel").waitFor();
await page.screenshot({ path: shot("22-records-desktop.png") });
const firstRecord = page.locator(".records-list article").first();
await firstRecord.locator(".record-detail-actions button").nth(0).click();
const translationDetail = await page.locator(".record-dialog").innerText();
await page.locator(".record-dialog > .button").click();
await firstRecord.locator(".record-detail-actions button").nth(1).click();
const companionDetail = await page.locator(".record-dialog").innerText();
await page.locator(".record-dialog > .button").click();
await firstRecord.locator(".record-detail-actions button").nth(2).click();
const feeDetail = await page.locator(".record-dialog").innerText();
await page.locator(".record-dialog > .button").click();
if (new Set([translationDetail, companionDetail, feeDetail]).size !== 3) throw new Error("Translation, companion and fee record dialogs still show identical content");
const downloadPromise = page.waitForEvent("download");
await firstRecord.locator(".record-manage-actions .button-secondary").click();
const download = await downloadPromise;
if (!download.suggestedFilename().endsWith(".json")) throw new Error("Visit record export did not create a JSON file");
await firstRecord.locator(".record-manage-actions .button-ghost").click();
await page.locator(".delete-record-dialog").waitFor();
await page.locator(".delete-record-dialog .button-secondary").click();
const recordCountBeforeDelete = await page.locator(".records-list article").count();
await firstRecord.locator(".record-manage-actions .button-ghost").click();
await page.locator(".delete-record-dialog").waitFor();
await page.locator(".delete-record-dialog .button-danger").click();
await page.locator(".delete-record-dialog").waitFor({ state: "detached" });
await page.waitForFunction((expected) => document.querySelectorAll(".records-list article").length === expected, recordCountBeforeDelete - 1);

await page.setViewportSize({ width: 430, height: 932 });
await page.locator(".bottom-nav button").nth(1).click();
await page.screenshot({ path: shot("03-agent-mobile.png"), fullPage: false });
await page.locator(".chat-composer input").fill("腹泻和呕吐");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".message-naru").filter({ hasText: "要不要去附近医院" }).waitFor({ timeout: 3000 });
await page.locator(".chat-composer input").fill("可以");
await page.locator(".chat-composer").evaluate((form) => form.requestSubmit());
await page.locator(".hospital-panel").waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await page.screenshot({ path: shot("07-hospitals-mobile.png"), fullPage: false });

console.log(JSON.stringify({ errors, screenshots: 25 }, null, 2));
await browser.close();
if (errors.length) throw new Error(`Browser console errors:\n${errors.join("\n\n")}`);
