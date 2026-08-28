/**
 * Client-bundle audit. Run after `npm run build`.
 *
 * Two questions, both of which have bitten this project before:
 *
 *  1. Did a server-only module reach the browser? A client component that
 *     value-imports something which transitively pulls `lib/db` drags the
 *     Prisma client — and Node built-ins like `dns` — into a client chunk. That
 *     happened once already, with `computeMmFee` sitting in the same file as a
 *     database reader; `tsc` and `next build` both passed. The split into
 *     `lib/mm-fee.ts` fixed it, and this catches the next one.
 *
 *  2. Did a real secret get inlined? Next.js only inlines `NEXT_PUBLIC_*`, so
 *     this should never happen — but "should never" is what a check is for.
 *     Every value in `.env` is searched for verbatim in the built chunks.
 *
 * Exits non-zero on a finding, so it can gate a deploy.
 */
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';

const CHUNK_GLOB = '.next/static/chunks/**/*.js';

/**
 * Markers that only ever appear in server code. Matched as plain substrings
 * against the built chunks.
 */
const SERVER_MARKERS = [
  'PrismaClient',
  '@prisma/adapter-pg',
  'prismaAdapter',
  'betterAuth(',
  'node:dns',
  'node:net',
  'node:tls',
  'node:fs',
  'node:crypto',
  'next/headers',
];

/**
 * Env names whose *values* must never appear in a chunk. Anything in `.env`
 * that is not NEXT_PUBLIC_ is treated as a secret.
 */
function readEnvValues() {
  if (!existsSync('.env')) return {};
  const out = {};
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...rest] = t.split('=');
    const v = rest.join('=').trim().replace(/^["']|["']$/g, '');
    // Short values produce false positives ("true" appears in every bundle).
    if (v.length >= 12 && !k.trim().startsWith('NEXT_PUBLIC_')) out[k.trim()] = v;
  }
  return out;
}

const files = globSync(CHUNK_GLOB);
if (files.length === 0) {
  console.error('No client chunks found. Run `npm run build` first.');
  process.exit(1);
}

const blobs = files.map((f) => [f, readFileSync(f, 'utf8')]);
const findings = [];

for (const marker of SERVER_MARKERS) {
  const hits = blobs.filter(([, b]) => b.includes(marker)).map(([f]) => f);
  if (hits.length) findings.push(`server marker ${JSON.stringify(marker)} in ${hits.join(', ')}`);
}

for (const [name, value] of Object.entries(readEnvValues())) {
  const hits = blobs.filter(([, b]) => b.includes(value)).map(([f]) => f);
  if (hits.length) findings.push(`SECRET ${name} inlined into ${hits.join(', ')}`);
}

console.log(`scanned ${files.length} client chunks`);
if (findings.length === 0) {
  console.log('No server-only code and no secret values in the client bundle.');
  process.exit(0);
}
for (const f of findings) console.error(`  FAIL  ${f}`);
console.error(`\n${findings.length} finding(s).`);
process.exit(1);
