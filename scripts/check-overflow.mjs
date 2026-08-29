/**
 * Horizontal-overflow check. Drives headless Chrome over CDP and asserts that no
 * element's right edge exceeds the viewport, per page and per width.
 *
 * It names the offending element rather than only reporting that the page
 * scrolls, because the element that overflows is almost never the one you would
 * guess from reading the markup — a grid item's automatic minimum size is its
 * min-content, so one unwrappable row deep inside a card widens the track above
 * it and the page below it.
 *
 * Needs `npm run dev` already running.
 *
 *   node scripts/check-overflow.mjs                      # public pages, desktop
 *   WIDTHS=375,768,1280 node scripts/check-overflow.mjs "/,/listings"
 *   SESSION_COOKIE=$(node scripts/demo-login.mjs kairo@exsaverse.demo)  *     node scripts/check-overflow.mjs "/deals"           # authenticated pages
 *
 * In Git Bash, prefix with MSYS_NO_PATHCONV=1 or the leading "/" of the first
 * path is rewritten into a Windows path and that page is silently skipped.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  // Truthiness so a blank CHROME_PATH falls back rather than spawning "".
  process.env.CHROME_PATH?.trim() ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const BASE = "http://localhost:3000";
const PAGES = process.argv[2]
  ? process.argv[2].split(",")
  : ["/", "/listings", "/middlemen", "/vouches", "/faqs", "/mints", "/blacklist"];
const WIDTHS = process.env.WIDTHS ? process.env.WIDTHS.split(",").map(Number) : [1280, 1440, 1920];

const profile = mkdtempSync(join(tmpdir(), "cdp-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--no-first-run",
  "about:blank",
]);

async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const page = j.find((t) => t.type === "page");
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("chrome did not come up");
}

const target = await targets();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const waiting = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && waiting.has(m.id)) {
    waiting.get(m.id)(m);
    waiting.delete(m.id);
  }
};
function send(method, params = {}) {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
}

const PROBE = `(() => {
  const de = document.documentElement;
  const limit = de.clientWidth;
  const over = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed") continue;
    if (r.right > limit + 1) {
      over.push({
        el,
        right: Math.round(r.right),
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute("class") || "").slice(0, 70),
        text: (el.textContent || "").trim().slice(0, 40),
      });
    }
  }
  // Ancestors inherit their child's overflow, so report only the deepest
  // offenders — those are the elements actually setting the width.
  const leaves = over.filter((o) => !over.some((p) => p !== o && o.el.contains(p.el)));
  over.length = 0;
  over.push(...leaves);
  over.sort((a, b) => b.right - a.right);
  return JSON.stringify({
    scrollW: de.scrollWidth,
    clientW: limit,
    top: over.slice(0, 4).map((o) => ({ right: o.right, tag: o.tag, cls: o.cls, text: o.text })),
  });
})()`;

// Authenticated pages need the session cookie planted before the first visit.
const COOKIE = process.env.SESSION_COOKIE;
if (COOKIE) {
  const [name, ...rest] = COOKIE.split("=");
  await send("Network.enable");
  await send("Network.setCookie", {
    name,
    value: rest.join("="),
    domain: "localhost",
    path: "/",
  });
}

let bad = 0;
for (const w of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: w,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const p of PAGES) {
    await send("Page.navigate", { url: BASE + p });
    await new Promise((r) => setTimeout(r, 1400));
    const res = await send("Runtime.evaluate", {
      expression: PROBE,
      returnByValue: true,
    });
    const out = JSON.parse(res.result.result.value);
    const scrolls = out.scrollW > out.clientW + 1;
    if (scrolls || out.top.length) {
      bad++;
      console.log(
        `FAIL ${w}px ${p}  scrollW=${out.scrollW} clientW=${out.clientW}`,
      );
      for (const o of out.top)
        console.log(`      right=${o.right} <${o.tag}> ${o.cls}
         text: ${o.text}`);
    } else {
      console.log(`ok   ${w}px ${p}`);
    }
  }
}
console.log(bad === 0 ? "\nNo horizontal overflow anywhere." : `\n${bad} page/width combinations overflow.`);
ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
