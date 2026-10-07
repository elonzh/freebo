import { spawn } from "node:child_process";
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import electron from "electron";
const output = path.resolve(".impeccable/review/brand-implementation");
const port = 9336;
await mkdir(output, { recursive: true });
const child = spawn(electron, [".", "--remote-debugging-port=" + port], {
  env: {
    ...process.env,
    FREEBO_DEV_URL: "http://127.0.0.1:5173",
    FREEBO_USER_DATA_DIR: path.join(output, "app-profile"),
    FREEBO_CAPTURE_DIR: output,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let startup = "";
child.stderr.on("data", (data) => {
  startup += data;
});
class CDP {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.errors = [];
    socket.addEventListener("message", ({ data }) => {
      const result = JSON.parse(data);
      if (result.id) {
        const pending = this.pending.get(result.id);
        if (!pending) return;
        this.pending.delete(result.id);
        if (result.error) pending.reject(new Error(result.error.message));
        else pending.resolve(result.result);
      } else if (result.method === "Runtime.exceptionThrown")
        this.errors.push(result.params.exceptionDetails.text);
    });
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const { result, exceptionDetails } = await this.call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails)
      throw new Error(
        exceptionDetails.text + " " + (exceptionDetails.exception?.description ?? ""),
      );
    return result.value;
  }
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function targets() {
  return fetch("http://127.0.0.1:" + port + "/json/list").then((r) => r.json());
}
async function connect(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const cdp = new CDP(socket);
  await cdp.call("Runtime.enable");
  return cdp;
}
async function ready(cdp) {
  await cdp.evaluate(`new Promise((resolve, reject) => { const end = Date.now() + 20000;
    const check = () => { if (window.desktop && document.querySelector(".browser-chrome")) resolve(true); else if (Date.now() > end) reject(new Error("App did not initialize")); else setTimeout(check, 80); }; check(); })`);
}
async function settle(cdp) {
  await cdp.evaluate("document.fonts.ready");
  await delay(140);
}
async function capture(cdp, filename, published) {
  await settle(cdp);
  const { data } = await cdp.call("Page.captureScreenshot", { format: "png" });
  const target = path.join(output, filename);
  await writeFile(target, Buffer.from(data, "base64"));
  if (published) await copyFile(target, path.resolve(published));
}
try {
  let list;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      list = await targets();
      if (list.some((t) => t.url.startsWith("http://127.0.0.1:5173"))) break;
    } catch {
      /* Wait for our owned process only. */
    }
    if (child.exitCode !== null) throw new Error(startup);
    await delay(100);
  }
  const target = list?.find((t) => t.type === "page" && t.url === "http://127.0.0.1:5173/");
  assert(target, "Main app target must exist");
  const cdp = await connect(target);
  await ready(cdp);
  const initial = await cdp.evaluate("window.desktop.getState()");
  assert.equal(initial.version, JSON.parse(await readFile("package.json", "utf8")).version);
  assert.equal(initial.platform, process.platform);
  await cdp.evaluate(
    `(async () => { await window.desktop.updateSettings({ theme:"light", language:"zh", setupCompleted:false }); await window.desktop.showPage("setup"); })()`,
  );
  await capture(cdp, "setup-light.png", "docs/assets/app/welcome.png");
  await cdp.evaluate('window.desktop.updateSettings({ language:"en" })');
  await capture(cdp, "setup-en.png", "docs/assets/app/welcome-en.png");
  await cdp.evaluate(
    `(async () => { await window.desktop.updateSettings({ language:"zh", setupCompleted:true }); await window.desktop.showPage("home"); })()`,
  );
  await capture(cdp, "home-light.png");
  const discovered = await cdp.evaluate("window.desktop.discoverPlayers()");
  await cdp.evaluate('window.desktop.showPage("settings","players")');
  await capture(cdp, "settings-light.png", "docs/assets/app/settings.png");
  await cdp.evaluate('window.desktop.updateSettings({ language:"en" })');
  await capture(cdp, "settings-en.png", "docs/assets/app/settings-en.png");
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 820,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await capture(cdp, "settings-en-minimum.png");
  const labelOverflow = await cdp.evaluate(`(() => {
    const rail = document.querySelector("aside");
    return [...rail.querySelectorAll("nav button span")].some(label => label.getBoundingClientRect().right > rail.getBoundingClientRect().right + 1);
  })()`);
  assert.equal(labelOverflow, false, "English settings labels must remain inside the narrow rail");
  await cdp.call("Emulation.clearDeviceMetricsOverride");
  await cdp.evaluate(
    `(async () => { await window.desktop.updateSettings({ theme:"dark", language:"zh" }); await window.desktop.showPage("home"); })()`,
  );
  await capture(cdp, "home-dark.png");
  await cdp.evaluate('window.desktop.showPage("settings","players")');
  await capture(cdp, "settings-dark.png");
  await cdp.evaluate('window.desktop.showPage("settings","about")');
  await capture(cdp, "about-dark.png");
  const dark = await cdp.evaluate(`({
    title: document.title, bg:getComputedStyle(document.documentElement).getPropertyValue("--background").trim(),
    primary:getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    images:[...document.images].filter(i => getComputedStyle(i).display !== "none").every(i => i.complete && i.naturalWidth > 0),
    overflow: document.documentElement.scrollWidth > innerWidth,
    atma: document.fonts.check('600 16px "Freebo Atma"'),
  })`);
  assert.equal(dark.title, "Freebo");
  assert.equal(dark.bg, "#17231f");
  assert.equal(dark.primary, "#bde64d");
  assert(dark.images);
  assert(dark.atma);
  assert.equal(dark.overflow, false);
  await cdp.evaluate("window.desktop.togglePlaybackPopup({x:1210,y:68,width:34,height:34})");
  await delay(300);
  const popupTarget = (await targets()).find(
    (t) => t.type === "page" && t.url.includes("surface=playback"),
  );
  assert(popupTarget, "Real native playback window must exist");
  const popup = await connect(popupTarget);
  await capture(popup, "playback-dark.png");
  await cdp.evaluate("window.desktop.hidePlaybackPopup()");
  await cdp.evaluate(
    `(async () => { await window.desktop.updateSettings({ theme:"light" }); await window.desktop.showPage("home"); })()`,
  );
  await cdp.call("Emulation.setDeviceMetricsOverride", {
    width: 820,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await capture(cdp, "minimum-layout.png");
  assert.equal(await cdp.evaluate("document.documentElement.scrollWidth > innerWidth"), false);
  await cdp.call("Emulation.clearDeviceMetricsOverride");
  assert.deepEqual(cdp.errors, []);
  await writeFile(
    path.join(output, "app-report.json"),
    JSON.stringify(
      {
        version: initial.version,
        platform: initial.platform,
        discoveredPlayers: discovered.settings.players.map((p) => p.name),
        dark,
        popup: true,
        minimumCssViewport: [820, 600],
        errors: cdp.errors,
        captions:
          "Actual Freebo app using its real preload/IPC and an isolated test profile. No server authentication or playback was attempted.",
      },
      null,
      2,
    ),
  );
  cdp.socket.close();
  popup.socket.close();
  console.log(
    "Real Electron app: brand assets, themes, locales, IPC, playback popup and minimum CSS viewport verified.",
  );
} finally {
  child.kill("SIGTERM");
}
