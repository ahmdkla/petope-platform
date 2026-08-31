/**
 * The upheld scammer cases the demo ships with.
 *
 * Lifted out of `prisma/seed.ts` so `scripts/seed-blacklist.ts` can add missing
 * ones to an already-seeded database without a destructive reset, from exactly
 * the same data. `seed.ts` runs its `main()` on import, so it cannot be
 * imported from.
 */
export type BlacklistCase = {
  /** Matches the account's displayName in the seed cast. */
  handle: string;
  /** displayName of the account that filed the report. */
  reporter: string;
  category: 'SCAM' | 'DM_IMPERSONATION' | 'ALT_ACCOUNT' | 'OTHER';
  /** How long ago the report was upheld and the account blacklisted. */
  daysAgo: number;
  evidence: string;
  reason: string;
  note: string;
};

/** email + displayName for the accounts these cases are filed against. */
export const BLACKLIST_ACCOUNTS: { email: string; displayName: string }[] = [
  { email: 'dredge@exsaverse.demo', displayName: 'dredge' },
  { email: 'vexnode@exsaverse.demo', displayName: 'vexnode' },
  { email: 'mirrorsmm@exsaverse.demo', displayName: 'mirrors_mm' },
  { email: 'nullkey@exsaverse.demo', displayName: 'nullkey' },
  { email: 'redredge@exsaverse.demo', displayName: 'dredge_2' },
  { email: 'slipmint@exsaverse.demo', displayName: 'slipmint' },
  { email: 'coldhandle@exsaverse.demo', displayName: 'coldhandle' },
];

export const BLACKLISTED: BlacklistCase[] = [
  {
    handle: 'dredge',
    reporter: 'kairo',
    category: 'SCAM',
    daysAgo: 2,
    evidence:
      'Took collateral on two deals, handed over a wallet with no whitelist role on either, then stopped replying. Both deals were refunded from collateral.',
    reason:
      'Took collateral on two deals and delivered a wallet with no whitelist role, then went silent. Report upheld after review.',
    note: 'Two independent deals, same pattern, both middlemen corroborated. Account blacklisted.',
  },
  {
    handle: 'vexnode',
    reporter: 'mirae',
    category: 'SCAM',
    daysAgo: 6,
    evidence:
      'Sold the same guaranteed spot to three buyers in the same afternoon. Two of us had already funded before the middleman spotted the overlap.',
    reason:
      'Sold one guaranteed spot to three buyers at the same time. Two deals were refunded from collateral.',
    note: 'Three funded deals against a listing with one spot. Refunds issued, collateral forfeited.',
  },
  {
    handle: 'mirrors_mm',
    reporter: 'kairo',
    category: 'DM_IMPERSONATION',
    daysAgo: 11,
    evidence:
      'Copied a middleman avatar and handle, messaged me first, and asked for the deal amount to be sent to a wallet that was not the one in the ticket.',
    reason:
      'Impersonated a middleman in DMs and asked buyers to pay a wallet outside the deal room.',
    note: 'Handle and avatar copied from the roster. Middlemen never DM first; the wallet matched no ticket.',
  },
  {
    handle: 'nullkey',
    reporter: 'mirae',
    category: 'SCAM',
    daysAgo: 17,
    evidence:
      'On a Wallet Submit deal I sent the wallet key so the spot could be submitted. The wallet was emptied within the hour and nothing was submitted.',
    reason:
      "Drained a buyer's wallet after a Wallet Submit handover instead of submitting it. Collateral forfeited to the buyer.",
    note: 'Timestamps put the transfer minutes after handover, before submission closed. Collateral paid to the buyer.',
  },
  {
    handle: 'dredge_2',
    reporter: 'dax',
    category: 'ALT_ACCOUNT',
    daysAgo: 24,
    evidence:
      'Same wallet address as an account blacklisted three weeks ago, same phrasing in the listing, back to selling the same project.',
    reason:
      'Ban evasion. Returned under a new handle sharing a wallet address with an already-blacklisted account.',
    note: 'Shared wallet flagged by alt-account detection and confirmed by hand.',
  },
  {
    handle: 'slipmint',
    reporter: 'kairo',
    category: 'SCAM',
    daysAgo: 31,
    evidence:
      'Mint For You deal. They minted on mint day and kept the NFT, then stopped replying in the ticket until the six-hour window ran out.',
    reason:
      'Took a Mint For You deal, minted to their own wallet and never transferred. Buyer received all funds and the collateral.',
    note: 'Mint transaction is on chain to their own address. Delivery window missed, deal failed to the buyer.',
  },
  {
    handle: 'coldhandle',
    reporter: 'lumi',
    category: 'SCAM',
    daysAgo: 40,
    evidence:
      'Discord Surrender deal. They handed over the account, then changed the recovery email and pulled it back before the role could be checked.',
    reason:
      'Reclaimed a surrendered Discord account after handover by changing its recovery email.',
    note: 'Account recovery changed nine minutes after handover was declared. Buyer refunded from collateral.',
  },
];
