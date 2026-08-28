/**
 * Scammer reports, review, and the public blacklist.
 * Run: npx tsx scripts/test-reports.ts
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { fileReportAsUser, reviewReportAsUser } from '../app/report/actions';
import type { CurrentUser } from '../lib/session';

let pass = 0, fail = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++; else fail++;
}
async function user(email: string): Promise<CurrentUser> {
  const u = await db.user.findUniqueOrThrow({ where: { email } });
  return { id: u.id, email: u.email, displayName: u.displayName,
    avatarUrl: u.avatarUrl, role: u.role, status: u.status };
}
/** Exactly what /blacklist renders. */
async function publicBlacklist() {
  return db.user.findMany({ where: { status: 'BLACKLISTED' }, select: { displayName: true } });
}

async function main() {
  const run = Date.now().toString(36);
  const reporter = await user('kairo@exsaverse.demo');
  const admin = await user('admin@exsaverse.demo');
  const plainMm = await user('rei@exsaverse.demo');

  // A throwaway account to act against, so no seeded user is left blacklisted.
  const target = await db.user.create({
    data: {
      email: `scammer.${run}@invalid.test`,
      displayName: `scammer_${run}`,
      termsAcceptedAt: new Date(),
    },
  });
  // Set at creation above; narrowed so the queries below typecheck.
  const targetHandle = target.displayName!;

  console.log('\nFILING');
  const filed = await fileReportAsUser(reporter, {
    accusedHandle: targetHandle,
    category: 'SCAM',
    evidence: 'Took the payment and never handed over the wallet. Ignored the room for two days.',
    evidenceUrl: 'https://solscan.io/tx/REPORTEVIDENCE',
    dealReference: null,
  });
  check('a member can file a report', filed.ok, filed.ok ? '' : filed.error);

  const report = await db.scammerReport.findFirstOrThrow({
    where: { accusedHandle: targetHandle },
  });
  check('it starts PENDING', report.status === 'PENDING');
  check('the handle was matched to an account', report.accusedUserId === target.id);

  const dup = await fileReportAsUser(reporter, {
    accusedHandle: targetHandle,
    category: 'SCAM',
    evidence: 'Filing the very same thing a second time to see what happens.',
    evidenceUrl: null,
    dealReference: null,
  });
  check('a duplicate pending report is refused', !dup.ok, dup.ok ? '' : dup.error);

  const self = await fileReportAsUser(reporter, {
    accusedHandle: reporter.displayName!,
    category: 'OTHER',
    evidence: 'Attempting to report my own account, which should not be allowed.',
    evidenceUrl: null,
    dealReference: null,
  });
  check('you cannot report yourself', !self.ok, self.ok ? '' : self.error);

  console.log('\nNOTHING IS PUBLIC BEFORE REVIEW');
  let listed = await publicBlacklist();
  check(
    'a pending report puts nobody on the blacklist',
    !listed.some((u) => u.displayName === targetHandle),
  );

  console.log('\nREVIEW ACCESS');
  const byMember = await reviewReportAsUser(reporter, {
    reportId: report.id, decision: 'uphold', note: null, blacklist: false,
  });
  check('an ordinary member cannot review', !byMember.ok, byMember.ok ? '' : byMember.error);

  const byMm = await reviewReportAsUser(plainMm, {
    reportId: report.id, decision: 'uphold', note: null, blacklist: false,
  });
  check('an ordinary middleman cannot review', !byMm.ok, byMm.ok ? '' : byMm.error);

  console.log('\nUPHOLD AND BLACKLIST');
  const upheld = await reviewReportAsUser(admin, {
    reportId: report.id,
    decision: 'uphold',
    note: 'Confirmed: took payment on two deals and never delivered.',
    blacklist: true,
  });
  check('an admin can uphold and blacklist', upheld.ok, upheld.ok ? '' : upheld.error);

  const after = await db.user.findUniqueOrThrow({ where: { id: target.id } });
  check('status set to BLACKLISTED', after.status === 'BLACKLISTED');
  check('reason recorded', after.blacklistReason?.includes('never delivered') === true);
  check('blacklisted by is recorded', after.blacklistedById === admin.id);

  listed = await publicBlacklist();
  check('now appears on the public blacklist',
    listed.some((u) => u.displayName === targetHandle));

  const ledger = await db.transactionLog.findFirst({
    where: { actorId: admin.id, action: 'ADMIN_OVERRIDE' },
    orderBy: { createdAt: 'desc' },
  });
  const meta = ledger?.metadata as { action?: string; accusedHandle?: string } | null;
  check('a ledger row names the admin and the action',
    meta?.action === 'blacklist' && meta?.accusedHandle === targetHandle);

  const twice = await reviewReportAsUser(admin, {
    reportId: report.id, decision: 'dismiss', note: 'Changed my mind about this one.', blacklist: false,
  });
  check('a decided report cannot be re-reviewed', !twice.ok, twice.ok ? '' : twice.error);

  console.log('\nDISMISSAL PUBLISHES NOTHING');
  const other = await db.user.create({
    data: {
      email: `innocent.${run}@invalid.test`,
      displayName: `innocent_${run}`,
      termsAcceptedAt: new Date(),
    },
  });
  const otherHandle = other.displayName!;
  await fileReportAsUser(reporter, {
    accusedHandle: otherHandle,
    category: 'DM_IMPERSONATION',
    evidence: 'Thought this account was messaging me, but it turned out to be someone else.',
    evidenceUrl: null,
    dealReference: null,
  });
  const second = await db.scammerReport.findFirstOrThrow({
    where: { accusedHandle: otherHandle },
  });

  const noNote = await reviewReportAsUser(admin, {
    reportId: second.id, decision: 'dismiss', note: null, blacklist: false,
  });
  check('dismissing requires a note', !noNote.ok, noNote.ok ? '' : noNote.error);

  const dismissed = await reviewReportAsUser(admin, {
    reportId: second.id,
    decision: 'dismiss',
    note: 'Mistaken identity; the reporter confirmed it was a different handle.',
    blacklist: false,
  });
  check('an admin can dismiss', dismissed.ok, dismissed.ok ? '' : dismissed.error);

  listed = await publicBlacklist();
  check('a dismissed report never reaches the blacklist',
    !listed.some((u) => u.displayName === otherHandle));

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
