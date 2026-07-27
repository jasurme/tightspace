import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), artifacts = path.join(root, "test-artifacts"), delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml" };

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      let relative = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, ""); if (!relative || relative.endsWith("/")) relative += "index.html";
      const target = path.resolve(root, relative); if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error("Forbidden");
      const body = await readFile(target); response.writeHead(200, { "Content-Type": mime[path.extname(target)] ?? "application/octet-stream", "Cache-Control": "no-store" }); response.end(body);
    } catch { response.writeHead(404, { "Content-Type": "text/plain" }); response.end("Not found"); }
  });
  return new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server)); });
}

class Cdp {
  constructor(socket) { this.socket = socket; this.sequence = 0; this.pending = new Map(); this.events = []; socket.addEventListener("message", event => this.receive(event.data)); }
  static async connect(url) { const socket = new WebSocket(url); await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); }); return new Cdp(socket); }
  receive(message) { const payload = JSON.parse(message); if (!payload.id) { this.events.push(payload); return; } const call = this.pending.get(payload.id); if (!call) return; this.pending.delete(payload.id); payload.error ? call.reject(new Error(payload.error.message)) : call.resolve(payload.result); }
  send(method, params = {}) { const id = ++this.sequence; return new Promise((resolve, reject) => { const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 10_000); this.pending.set(id, { resolve: value => { clearTimeout(timeout); resolve(value); }, reject: error => { clearTimeout(timeout); reject(error); } }); this.socket.send(JSON.stringify({ id, method, params })); }); }
  close() { this.socket.close(); }
}

async function findChrome() {
  const candidates = [process.env.CHROME_BIN, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  for (const candidate of candidates) try { await access(candidate); return candidate; } catch {}
  throw new Error("Chrome or Chromium was not found. Set CHROME_BIN to its executable path.");
}

async function reservePort() {
  const probe = createServer(); await new Promise((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); }); const { port } = probe.address(); await new Promise(resolve => probe.close(resolve)); return port;
}

async function waitForChrome(port, processHandle, errorOutput) {
  for (let attempt = 0; attempt < 300; attempt++) { if (processHandle.exitCode !== null) throw new Error(`Chrome exited before its debugging endpoint became ready. ${errorOutput()}`); try { const response = await fetch(`http://127.0.0.1:${port}/json/list`); if (response.ok) return response.json(); } catch {} await delay(50); }
  throw new Error(`Chrome debugging endpoint did not become ready. ${errorOutput()}`);
}

const server = await startServer(), address = server.address(), baseUrl = `http://127.0.0.1:${address.port}`, profile = await mkdtemp(path.join(tmpdir(), "tightspace-chrome-"));
let chrome, cdp;
try {
  const chromePath = await findChrome(), debugPort = await reservePort(); let chromeError = ""; chrome = spawn(chromePath, ["--headless=new", "--disable-background-networking", "--disable-default-apps", "--disable-dev-shm-usage", "--disable-extensions", "--disable-gpu", "--disable-sync", "--no-first-run", "--no-default-browser-check", "--no-sandbox", "--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] }); chrome.stderr.on("data", chunk => { chromeError = `${chromeError}${chunk}`.slice(-4000); });
  const targets = await waitForChrome(debugPort, chrome, () => chromeError.trim()), page = targets.find(target => target.type === "page" && target.url === "about:blank") ?? targets.find(target => target.type === "page"); if (!page) throw new Error("Chrome did not expose a page target"); cdp = await Cdp.connect(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
  const evaluate = async expression => { const value = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.text); return value.result.value; };
  const waitFor = async (expression, message) => { for (let attempt = 0; attempt < 120; attempt++) { try { if (await evaluate(expression)) return; } catch {} await delay(50); } throw new Error(`Timed out waiting for ${message}`); };
  const navigate = async route => { await cdp.send("Page.navigate", { url: `${baseUrl}${route}` }); await waitFor(`document.readyState === "complete" && location.pathname === ${JSON.stringify(route)}`, route); await waitFor(`document.querySelector("[data-theme-toggle]")?.getAttribute("aria-label")?.startsWith("Switch to")`, `${route} scripts`); };
  const reload = async message => { const previousTimeOrigin = await evaluate(`performance.timeOrigin`); await cdp.send("Page.reload", { ignoreCache: true }); await waitFor(`performance.timeOrigin !== ${previousTimeOrigin} && document.readyState === "complete"`, message); };
  const key = async (keyValue, code = keyValue, modifiers = 0) => { await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: keyValue, code, modifiers }); await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: keyValue, code, modifiers }); };
  const screenshot = async name => { const image = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await mkdir(artifacts, { recursive: true }); await writeFile(path.join(artifacts, name), image.data, "base64"); };
  const setViewport = (width, height) => cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width <= 600 });

  await setViewport(1440, 900); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }, { name: "prefers-reduced-motion", value: "no-preference" }] }); await navigate("/");
  assert.deepEqual(await evaluate(`[...document.querySelectorAll(".primary-nav .nav-link")].map(link => link.textContent)`), ["About", "Posts"]); assert.equal(await evaluate(`document.querySelector('[aria-current="page"]').textContent`), "About");
  assert.equal(await evaluate(`document.documentElement.dataset.theme`), "light"); assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true); await screenshot("desktop-light.png");

  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }); await waitFor(`document.documentElement.dataset.theme === "dark"`, "system dark theme"); await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "light" }] }); await waitFor(`document.documentElement.dataset.theme === "light"`, "system light theme");
  await evaluate(`localStorage.setItem("tightspace-theme", "corrupt")`); await reload("invalid stored-theme reload"); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "light");
  await evaluate(`document.querySelector("[data-theme-toggle]").click()`); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "dark"); assert.equal(await evaluate(`localStorage.getItem("tightspace-theme")`), "dark");
  assert.equal(await evaluate(`document.querySelector("[data-theme-toggle]").getAttribute("aria-label")`), "Switch to light mode"); await reload("persisted dark-theme reload"); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "dark"); await screenshot("desktop-dark.png");

  await key("k", "KeyK", 2); await waitFor(`document.querySelector("[data-search-dialog]").open`, "keyboard-opened search"); assert.equal(await evaluate(`document.activeElement === document.querySelector("[data-search-input]")`), true); assert.equal(await evaluate(`document.querySelectorAll('[role="option"]').length`), 3);
  await key("Tab", "Tab"); assert.equal(await evaluate(`document.activeElement === document.querySelector("[data-search-close]")`), true); await key("Tab", "Tab"); assert.equal(await evaluate(`document.activeElement === document.querySelector("[data-search-input]")`), true);
  await key("ArrowUp", "ArrowUp"); assert.equal(await evaluate(`document.querySelector("[data-search-input]").getAttribute("aria-activedescendant")`), "search-result-train-ai-m1"); await key("Escape", "Escape"); await waitFor(`!document.querySelector("[data-search-dialog]").open && document.activeElement === document.querySelector("[data-search-open]")`, "Escape close and focus restoration");

  await evaluate(`document.querySelector("[data-search-open]").click()`); await waitFor(`document.querySelector("[data-search-dialog]").open`, "pointer-opened search");
  await evaluate(`(()=>{const input=document.querySelector("[data-search-input]");input.value="MACBOOK";input.dispatchEvent(new Event("input",{bubbles:true}))})()`); assert.deepEqual(await evaluate(`[...document.querySelectorAll('[role="option"]')].map(option => option.textContent)`), ["how can i train ai model on Macbook M1 air"]);
  await evaluate(`(()=>{const input=document.querySelector("[data-search-input]");input.value='<>&"\\'💥';input.dispatchEvent(new Event("input",{bubbles:true}))})()`); assert.equal(await evaluate(`document.querySelectorAll('[role="option"]').length`), 0); assert.equal(await evaluate(`document.querySelector(".search-empty").textContent`), "No results"); const pathBeforeEmptyEnter = await evaluate(`location.pathname`); await key("Enter", "Enter"); assert.equal(await evaluate(`location.pathname`), pathBeforeEmptyEnter);
  await evaluate(`(()=>{const input=document.querySelector("[data-search-input]");input.value="x".repeat(10000);input.dispatchEvent(new Event("input",{bubbles:true}))})()`); assert.equal(await evaluate(`document.querySelectorAll('[role="option"]').length`), 0);
  await evaluate(`(()=>{const input=document.querySelector("[data-search-input]");input.value="hi";input.dispatchEvent(new Event("input",{bubbles:true}))})()`); assert.equal(await evaluate(`document.querySelectorAll('[role="option"]').length`), 1); await screenshot("desktop-search-dark.png"); await key("Enter", "Enter"); await waitFor(`location.pathname === "/posts/how-can-i-train-ai-model-on-macbook-m1-air/" && document.readyState === "complete"`, "search result navigation");
  assert.equal(await evaluate(`document.querySelector("article h1").textContent`), "how can i train ai model on Macbook M1 air"); assert.equal(await evaluate(`document.querySelector(".article-body").textContent.trim()`), "hi"); assert.equal(await evaluate(`document.querySelector('[aria-current="page"]').textContent`), "Posts"); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "dark");
  await reload("direct article reload"); assert.equal(await evaluate(`document.querySelector("article h1").textContent`), "how can i train ai model on Macbook M1 air");

  await setViewport(320, 568); await navigate("/"); const mobile = await evaluate(`({overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,search:[document.querySelector("[data-search-open]").getBoundingClientRect().width,document.querySelector("[data-search-open]").getBoundingClientRect().height],theme:[document.querySelector("[data-theme-toggle]").getBoundingClientRect().width,document.querySelector("[data-theme-toggle]").getBoundingClientRect().height],links:[...document.querySelectorAll(".primary-nav .nav-link")].every(link=>getComputedStyle(link).display!=="none")})`);
  assert.equal(mobile.overflow, false); assert.equal(mobile.links, true); assert.ok(mobile.search.every(size => size >= 44)); assert.ok(mobile.theme.every(size => size >= 44)); await screenshot("mobile-home-dark.png");
  await evaluate(`document.querySelector("[data-search-open]").click()`); await waitFor(`document.querySelector("[data-search-dialog]").open`, "mobile search"); assert.equal(await evaluate(`document.querySelector("[data-search-dialog]").getBoundingClientRect().width <= innerWidth`), true); await screenshot("mobile-search-dark.png"); await evaluate(`document.querySelector("[data-search-dialog]").click()`); await waitFor(`!document.querySelector("[data-search-dialog]").open`, "backdrop-closed search");

  await setViewport(320, 320); await evaluate(`document.querySelector("[data-search-open]").click()`); await waitFor(`document.querySelector("[data-search-dialog]").open`, "short-viewport search"); assert.equal(await evaluate(`(()=>{const dialog=document.querySelector("[data-search-dialog]").getBoundingClientRect(),footer=document.querySelector(".search-footer").getBoundingClientRect();return dialog.top>=0&&dialog.bottom<=innerHeight&&footer.bottom<=dialog.bottom+1})()`), true); await evaluate(`document.querySelector("[data-search-dialog]").close()`);

  await setViewport(2560, 1440); await navigate("/posts/"); assert.equal(await evaluate(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true); assert.equal(await evaluate(`document.querySelectorAll(".post-link").length`), 1);
  const storageFailureScript = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: `Storage.prototype.getItem=function(){throw new Error("blocked storage")};Storage.prototype.setItem=function(){throw new Error("blocked storage")}` }); await navigate("/"); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "light"); await evaluate(`document.querySelector("[data-theme-toggle]").click()`); assert.equal(await evaluate(`document.documentElement.dataset.theme`), "dark"); await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: storageFailureScript.identifier });
  const browserErrors = cdp.events.filter(event => event.method === "Runtime.exceptionThrown" || event.method === "Log.entryAdded" && event.params?.entry?.level === "error"); assert.deepEqual(browserErrors.map(event => event.method), []); console.log("Browser smoke tests passed: desktop/mobile layouts, theme persistence and failures, keyboard focus, search extremes, short viewports, clean routes, and direct reloads.");
} finally {
  cdp?.close(); chrome?.kill("SIGTERM"); await new Promise(resolve => server.close(resolve)); await rm(profile, { recursive: true, force: true });
}
