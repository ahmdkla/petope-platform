// Throwaway verification: proves each database-level constraint actually fires.
// Run: node scripts/verify-constraints.mjs
//
// NOTE: this necessarily leaves undeletable vt_* rows behind — the ledger
// trigger blocks deleting the TransactionLog rows, and onDelete: Restrict
// propagates that up through Deal to User. Follow it with `prisma migrate
// reset` to get back to a clean, seeded database.
import 'dotenv/config';
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const run = async (label, sql, params = []) => {
  console.log('\n' + '='.repeat(72));
  console.log(label);
  console.log('-'.repeat(72));
  console.log(sql.trim());
  console.log('-'.repeat(72));
  try {
    const r = await c.query(sql, params);
    console.log(`NO ERROR. rowCount=${r.rowCount}`);
    return { ok: true, rowCount: r.rowCount };
  } catch (e) {
    console.log(`ERROR  code=${e.code}`);
    console.log(`       message: ${e.message}`);
    if (e.constraint) console.log(`       constraint: ${e.constraint}`);
    if (e.table) console.log(`       table: ${e.table}`);
    return { ok: false, code: e.code, constraint: e.constraint };
  }
};

// --- seed the minimum rows the tests need ---------------------------------
console.log('### seeding fixtures');
await c.query(`
  INSERT INTO "User" (id, email, "displayName", role, status, "createdAt", "updatedAt")
  VALUES
    ('vt_buyer','vt_buyer@invalid.test','vt_buyer','USER','ACTIVE',now(),now()),
    ('vt_seller','vt_seller@invalid.test','vt_seller','USER','ACTIVE',now(),now()),
    ('vt_mm','vt_mm@invalid.test','vt_mm','MIDDLEMAN','ACTIVE',now(),now())
  ON CONFLICT (id) DO NOTHING;
`);
await c.query(`
  INSERT INTO "Deal" (id, reference, "batchNumber", "buyerId", "sellerId", status,
                      "projectName", chain, "dealAmount", "mmFee", asset, quantity,
                      specific, "priceType", "createdAt", "updatedAt")
  VALUES ('vt_deal','VT-1',1,'vt_buyer','vt_seller','OPEN','VerifyProj','Solana',
          1000,50,'USDC',1,'GTD','FOR_ALL',now(),now())
  ON CONFLICT (id) DO NOTHING;
`);
await c.query(`
  INSERT INTO "TransactionLog" (id, "dealId", "actorId", action, "createdAt")
  VALUES ('vt_log','vt_deal','vt_mm','DEAL_CREATED',now())
  ON CONFLICT (id) DO NOTHING;
`);
console.log('seeded: 3 users, 1 deal, 1 transaction log row');

const results = {};

results.update = await run(
  'TEST 1 — UPDATE "TransactionLog" must RAISE, not silently no-op',
  `UPDATE "TransactionLog" SET action = 'ADMIN_OVERRIDE' WHERE id = 'vt_log';`,
);

results.delete = await run(
  'TEST 2 — DELETE FROM "TransactionLog" must RAISE',
  `DELETE FROM "TransactionLog" WHERE id = 'vt_log';`,
);

results.selfVerify = await run(
  'TEST 3 — PaymentProof with verifiedById = submittedById must violate CHECK',
  `INSERT INTO "PaymentProof" (id, "dealId", kind, "submittedById", "submittedAt",
                               reference, status, "verifiedById", "verifiedAt")
   VALUES ('vt_proof','vt_deal','BUYER_PAYMENT','vt_mm',now(),
           'https://solscan.io/tx/FAKE','CONFIRMED','vt_mm',now());`,
);

results.selfDeal = await run(
  'TEST 4 — Deal with buyerId = sellerId must violate CHECK',
  `INSERT INTO "Deal" (id, reference, "batchNumber", "buyerId", "sellerId", status,
                       "projectName", chain, "dealAmount", "mmFee", asset, quantity,
                       specific, "priceType", "createdAt", "updatedAt")
   VALUES ('vt_selfdeal','VT-SELF',2,'vt_buyer','vt_buyer','OPEN','SelfDeal','Solana',
           1000,50,'USDC',1,'GTD','FOR_ALL',now(),now());`,
);

// --- bonus: the two constraints not in the original test list --------------
results.mmIsParty = await run(
  'TEST 5 (bonus) — Deal with middlemanId = buyerId must violate CHECK',
  `INSERT INTO "Deal" (id, reference, "batchNumber", "buyerId", "sellerId", "middlemanId",
                       status, "projectName", chain, "dealAmount", "mmFee", asset, quantity,
                       specific, "priceType", "createdAt", "updatedAt")
   VALUES ('vt_mmparty','VT-MM',3,'vt_buyer','vt_seller','vt_buyer','OPEN','MMParty','Solana',
           1000,50,'USDC',1,'GTD','FOR_ALL',now(),now());`,
);

results.insertStillWorks = await run(
  'TEST 6 (control) — a legitimate TransactionLog INSERT must still succeed',
  `INSERT INTO "TransactionLog" (id, "dealId", "actorId", action, "createdAt")
   VALUES ('vt_log2','vt_deal','vt_mm','AUDIT_ACCESS',now());`,
);

// --- cleanup attempt -------------------------------------------------------
console.log('\n' + '='.repeat(72));
console.log('CLEANUP — attempting to remove test fixtures');
console.log('-'.repeat(72));
const cleanup = [
  [`DELETE FROM "TransactionLog" WHERE id LIKE 'vt_%';`, 'transaction logs'],
  [`DELETE FROM "Deal" WHERE id LIKE 'vt_%';`, 'deal'],
  [`DELETE FROM "User" WHERE id LIKE 'vt_%';`, 'users'],
];
const leftovers = [];
for (const [sql, what] of cleanup) {
  try {
    const r = await c.query(sql);
    console.log(`  removed ${what}: rowCount=${r.rowCount}`);
  } catch (e) {
    console.log(`  COULD NOT remove ${what}: ${e.code} ${e.message.split('\n')[0]}`);
    leftovers.push(what);
  }
}

console.log('\n' + '='.repeat(72));
console.log('SUMMARY');
console.log('-'.repeat(72));
const expect = (k, want) => {
  const r = results[k];
  const got = r.ok ? 'no error' : `${r.code}${r.constraint ? ' / ' + r.constraint : ''}`;
  const pass = r.ok === want;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${k.padEnd(18)} expected ${want ? 'success' : 'error'}, got ${got}`);
  return pass;
};
const all = [
  expect('update', false), expect('delete', false), expect('selfVerify', false),
  expect('selfDeal', false), expect('mmIsParty', false), expect('insertStillWorks', true),
];
console.log(`\n  ${all.every(Boolean) ? 'ALL CHECKS BEHAVED AS EXPECTED' : 'SOME CHECKS DID NOT BEHAVE AS EXPECTED'}`);
if (leftovers.length) console.log(`  LEFTOVER TEST ROWS (not deletable): ${leftovers.join(', ')}`);

await c.end();
