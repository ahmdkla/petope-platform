/**
 * Signs a seeded demo account in and prints its session cookie, so
 * `check-overflow.mjs` (or curl) can reach authenticated pages.
 *
 *   node scripts/demo-login.mjs kairo@exsaverse.demo
 *
 * Demo passwords only — this is seeded data with no real funds behind it.
 */
const email = process.argv[2];
const res = await fetch("http://localhost:3000/api/auth/sign-in/email", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "http://localhost:3000",
  },
  body: JSON.stringify({ email, password: "Exsaverse789" }),
});
const setCookie = res.headers.getSetCookie?.() ?? [];
if (!res.ok) {
  console.error("sign-in failed", res.status, await res.text());
  process.exit(1);
}
const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
console.log(cookie);
