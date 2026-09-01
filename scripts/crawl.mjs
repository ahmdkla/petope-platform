/**
 * Whole-app crawl. Visits every route in every auth state and reports anything
 * that is broken — not just a bad status code.
 *
 * A page can return 200 and still be broken: a server component that throws
 * renders an error boundary, and a client component that throws during
 * hydration leaves a shell with an exception in the console. Both are checked.
 *
 *   IDS=$(npx tsx scripts/crawl-ids.ts) node scripts/crawl.mjs
 *
 * IDS is not optional in practice: without it the dynamic routes below are
 * visited as the literal "undefined" and every one is reported as a 404.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.env.BASE || "http://localhost:3000";
const PORT = 9530;

const ID = JSON.parse(process.env.IDS || "{}");

/** [path, minimum role that should see it] — "any" means signed out too. */
const ROUTES = [
  ["/", "any"],
  ["/listings", "any"],
  ["/listings?side=BUY", "any"],
  ["/listings?chain=Solana&specific=GTD", "any"],
  ["/listings?q=Basecamp", "any"],
  ["/last-sales", "any"],
  ["/middlemen", "any"],
  ["/middlemen?filter=on-shift", "any"],
  ["/vouches", "any"],
  [`/vouches?mm=${ID.mm}`, "any"],
  ["/mints", "any"],
  ["/faqs", "any"],
  ["/blacklist", "any"],
  [`/u/${ID.user}`, "any"],
  [`/u/${ID.mm}`, "any"],
  ["/sign-in", "any"],
  ["/sign-up", "any"],
  ["/listings/new", "user"],
  ["/deals", "user"],
  ["/deals?role=buyer", "user"],
  [`/deals/${ID.deal}`, "user"],
  ["/profile", "user"],
  ["/support", "user"],
  [`/support/${ID.ticket}`, "user"],
  ["/report", "user"],
  ["/queue", "mm"],
  ["/admin/disputes", "admin"],
  ["/admin/reports", "admin"],
  ["/admin/users", "admin"],
  ["/admin/timers", "admin"],
  ["/admin/fee-refunds", "admin"],
  ["/admin/settings", "admin"],
];

const ACCOUNTS = {
  anon: null,
  user: "kairo@exsaverse.demo",
  mm: "nadia@exsaverse.demo",
  admin: "admin@exsaverse.demo",
};

async function login(email) {
  const r = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email, password: "Exsaverse789" }),
  });
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${r.status}`);
  return (r.headers.getSetCookie() ?? []).map((c) => c.split(";")[0]).join("; ");
}

const profile = mkdtempSync(join(tmpdir(), "crawl-"));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--no-first-run", "--hide-scrollbars", "--window-size=1400,900", "about:blank"]);

async function target() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const p = (await r.json()).find((t) => t.type === "page");
      if (p) return p;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("chrome did not start");
}
const t = await target();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const waiting = new Map();
let problems = [];
const fmt = (a) => (a.value !== undefined ? String(a.value) : a.description ?? a.type);
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params.exceptionDetails;
    problems.push("uncaught: " + String(d.exception?.description ?? d.text).split("\n")[0].slice(0, 160));
  }
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
    const s = m.params.args.map(fmt).join(" ");
    if (!/DevTools|Download the React/i.test(s)) problems.push("console.error: " + s.slice(0, 160));
  }
  if (m.id && waiting.has(m.id)) { waiting.get(m.id)(m); waiting.delete(m.id); }
};
const send = (method, params = {}) => {
  const n = ++id;
  ws.send(JSON.stringify({ id: n, method, params }));
  return new Promise((r) => waiting.set(n, r));
};
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.exceptionDetails ? "THREW" : r.result?.result?.value;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const results = [];
for (const [role, email] of Object.entries(ACCOUNTS)) {
  const cookie = email ? await login(email) : null;
  await send("Network.clearBrowserCookies");
  if (cookie) {
    const [name, ...rest] = cookie.split("=");
    await send("Network.setCookie", { name, value: rest.join("="), domain: "localhost", path: "/" });
  }
  for (const [path] of ROUTES) {
    problems = [];
    await send("Page.navigate", { url: BASE + path });
    await sleep(2600);
    const info = await ev(`(() => {
      const body = document.body ? document.body.innerText : "";
      return JSON.stringify({
        url: location.pathname + location.search,
        title: document.title,
        len: body.trim().length,
        errorBoundary: /Application error|something went wrong|Unhandled Runtime Error|This page could not be found/i.test(body),
        hasMain: !!document.querySelector("main, form"),
      });
    })()`);
    const d = info === "THREW" ? { url: "?", title: "?", len: 0, errorBoundary: true, hasMain: false } : JSON.parse(info);
    const redirected = d.url !== path.split("#")[0];
    const bad = d.errorBoundary || d.len < 40 || problems.length > 0;
    results.push({ role, path, ...d, redirected, problems: [...new Set(problems)] });
    if (bad) {
      console.log(`\n[${role}] ${path}`);
      console.log(`   title="${d.title}" bodyLen=${d.len} errorBoundary=${d.errorBoundary} landedOn=${d.url}`);
      for (const p of new Set(problems)) console.log(`   ${p}`);
    }
  }
}
const broken = results.filter((r) => r.errorBoundary || r.len < 40 || r.problems.length);
console.log(`\n${results.length} page loads, ${broken.length} with problems.`);
if (!broken.length) console.log("No broken pages.");
ws.close(); chrome.kill(); process.exit(broken.length ? 1 : 0);
