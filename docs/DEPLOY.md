# Deploying EXSAVERSE to Vercel

Next.js 16 + Prisma 7 + Neon Postgres + Better Auth. Set up from the Vercel
dashboard; nothing here needs the Vercel CLI.

> **This is a demo build.** `DEMO_MODE=true` ships a persistent banner stating
> that no real payments are processed. It does **not** weaken the escrow rules:
> a payment proof is still confirmed by a human middleman, never automatically.

---

## 1. What the build does

`package.json`:

```json
"build": "prisma generate && prisma migrate deploy && next build"
```

Vercel runs `npm run build` by default, so no Build Command override is needed.

| Step | Why it is there |
|---|---|
| `prisma generate` | Vercel caches `node_modules` between builds, so a schema change would otherwise compile against a stale generated client. |
| `prisma migrate deploy` | Applies committed migrations, in order, once. It **only** applies files already in `prisma/migrations/` — it never creates a migration, never resets, never drops, and **never runs the seed**. |
| `next build` | The application build. |

`prisma` and `tsx` are `devDependencies`; Vercel installs devDependencies during
a build, so both are available.

Use `npm run build:local` (`prisma generate && next build`) for a build that
does not touch the database — useful in CI or when the database is unreachable.

### Migrations run against the pooled endpoint

`prisma.config.ts` supplies the CLI's connection string, preferring `DIRECT_URL`
and falling back to `DATABASE_URL`. Migrations do work through Neon's pooled
endpoint on this project — all ten applied through it — but Prisma Migrate takes
a session-scoped advisory lock and Neon's pooler is PgBouncer in transaction
mode, which can drop one. If a deploy ever fails with an advisory-lock or
`P3005`-style error, set `DIRECT_URL` to the unpooled string and redeploy. The
running application always uses the pooled `DATABASE_URL` either way.

---

## 2. Environment variables

Set these in **Project → Settings → Environment Variables**. Full descriptions
are in [`.env.example`](../.env.example); this is the deployment summary.

| Variable | Required | Environments | Secret | Value |
|---|---|---|---|---|
| `DATABASE_URL` | **yes** | Production, Preview, Development | yes | **Pooled** Neon string (host contains `-pooler`) with `sslmode=verify-full&channel_binding=require` |
| `BETTER_AUTH_URL` | **yes** | Production, Preview, Development | no | The exact origin, no trailing slash. Sign-in does not work without it. |
| `BETTER_AUTH_SECRET` | **yes** | Production, Preview, Development | yes | `openssl rand -hex 32`, a different value per environment |
| `DEMO_MODE` | **yes** | Production, Preview, Development | no | `true` |
| `DIRECT_URL` | no | Production only | yes | Unpooled Neon string. Only if a migration fails on a lock. |

> **A blank value is not a missing one.** A variable added in the dashboard and
> left empty reads as present in the UI but is `""` at runtime, which slips past
> a `??` fallback. Every read in this project uses a truthiness check for that
> reason, but a blank value still means the feature it configures is off. After
> setting these, confirm each one has a value — not merely a row.

Three things that cause real, confusing failures:

- **`DATABASE_URL` must be the pooled string.** Serverless opens a connection
  per invocation; a direct endpoint runs out of connections under any traffic.
  Neon labels it "Pooled connection" in the dashboard.
- **`sslmode=verify-full`, not `require`.** `require` encrypts the link but
  authenticates nothing, so it does not stop an interception. `verify-full`
  checks the certificate *and* that the hostname matches it. Neon serves a
  publicly-trusted certificate, so no CA bundle is needed.
- **`BETTER_AUTH_URL` must be set, and must match the origin the browser
  actually uses.** It is the easiest of these to skip, because nothing crashes
  without it — which is precisely the problem. Two things fail quietly:
  Better Auth checks the request `Origin` against it, so sign-in is rejected
  with `MISSING_OR_NULL_ORIGIN` / `INVALID_ORIGIN` and the form simply refuses;
  and it is the base for OpenGraph URLs, so link previews resolve against
  `localhost` and show nothing. For Production use the custom domain, or the
  stable production `*.vercel.app` URL — never a per-deployment preview URL,
  which changes every push.

  If it is absent the build now falls back to `localhost` and prints
  `[metadata] BETTER_AUTH_URL is not set` into the build log rather than dying,
  so **check the build output** — a successful deploy is not evidence that it
  was configured.

### Preview deployments

Preview URLs are per-deployment, so a single `BETTER_AUTH_URL` cannot match them
all and sign-in will fail on previews. Either accept that previews are
signed-out-only, or give the Preview environment a stable alias domain and point
`BETTER_AUTH_URL` at it.

Previews share whatever `DATABASE_URL` you give them. Pointing Preview at the
production database means preview code writes production rows — use a separate
Neon branch for Preview if that matters.

---

## 3. First deploy

1. Import the Git repository in Vercel. Framework preset: **Next.js**. Leave the
   Build Command alone — `npm run build` is the default and already correct.
2. Add the environment variables above **before** the first build. `prisma
   migrate deploy` runs during the build and needs `DATABASE_URL` present.
3. Deploy. The build applies all ten migrations to an empty Neon database and
   creates the schema, including:
   - the `transaction_log_no_change` trigger that makes the ledger append-only
   - the `payment_proof_no_self_verification`, `deal_buyer_is_not_seller` and
     `deal_middleman_is_not_a_party` CHECK constraints
4. The site is up, with **no accounts and an empty marketplace**. Seeding is a
   separate, deliberate step — see below.

---

## 4. The seed does not run automatically

**Confirmed by construction and by test.**

`prisma.config.ts` registers `seed: 'tsx prisma/seed.ts'` under `migrations`.
That entry is invoked by exactly three commands:

- `prisma db seed`
- `prisma migrate dev` — local development only
- `prisma migrate reset` — **drops the database**

The build runs `prisma migrate deploy`, which is not one of them. Verified
directly: running `prisma migrate deploy` three times in a row against the
seeded database left every row count identical (`users: 37, listings: 45,
deals: 67, vouches: 5`) and created no duplicate accounts.

This matters beyond tidiness. The seed calls `auth.api.signUpEmail` for fifteen
accounts with a **known shared password**. If it ran on every deploy it would
either fail on the unique email constraint or, worse, silently re-create
sign-in-able accounts on a live site.

### Running the seed once, manually, after the first deploy

Run it from your machine against the production database. There is no step that
runs it on Vercel.

```bash
# 1. Point at the production database for this command only.
#    Do NOT write the production URL into your local .env.
export DATABASE_URL="postgresql://...-pooler.../neondb?sslmode=verify-full&channel_binding=require"

# 2. Confirm you are pointed where you think you are.
npx prisma migrate status

# 3. Seed.
npm run db:seed
```

It prints every account, role and password when it finishes.

**It is not idempotent** — a second run fails on duplicate emails. That is
deliberate: failing loudly beats quietly creating a second set of accounts. To
re-seed you must reset the database, which destroys the append-only ledger, so
treat it as a first-deploy-only step.

> `prisma migrate reset` is destructive: it drops the schema, wiping the
> `TransactionLog` that the database trigger otherwise makes impossible to
> delete. Never run it against a database anyone is using.

After seeding, sign in as `admin@exsaverse.demo` and change the demo passwords,
or leave them if this stays a demo. The seeded `dredge` account is
`BLACKLISTED` on purpose — `proxy.ts` rejects its session on the next request,
which is the behaviour worth demonstrating.

---

## 5. Pre-deploy checks

None of these are wired into the Vercel build; run them locally before pushing.

```bash
npx tsc --noEmit          # types
npm run lint              # eslint
npm run build:local       # production build, no database
npm run check:bundle      # server-only code / secrets in client chunks
npm run check:contrast    # WCAG AA on both themes
npm run check:overflow    # horizontal overflow, needs `npm run dev` running
```

`check:bundle` reads the chunks that a build just produced, so run it after a
build. It fails if a client chunk contains `PrismaClient`, `next/headers`, a
Node built-in, or the literal value of any non-`NEXT_PUBLIC_` variable in
`.env`. This project shipped that bug once — a pure fee calculator living in the
same module as a database reader pulled `dns` into a client bundle, and both
`tsc` and `next build` passed.

The escrow test suites need a database and write test rows; run them against a
local or branch database, never production:

```bash
for t in lifecycle proofs release fee supply support reports mints; do
  npx tsx scripts/test-$t.ts
done
```

---

## 6. Known gaps at deploy time

- **Email delivery is not wired up.** `sendVerificationEmail` and
  `sendResetPassword` only log under `DEMO_MODE`, and
  `requireEmailVerification` is off. Do not present password reset as working.
- **No scheduled job runs the release timers.** The 24h / 6h / 2h deadlines are
  stored and indexed, but only the manual "run due timers" action in
  `/admin/timers` advances them. A deployed instance needs a Vercel Cron or
  Inngest job before the timers can be called enforced.
- **No file uploads.** Evidence and proof screenshots are URL fields.
- **Discord OAuth is deferred.** The `User.discordId` / `discordUsername`
  columns exist and are nullable, ready for `socialProviders.discord`.
