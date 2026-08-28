import { db } from './db';

/**
 * Alt-account / same-person detection.
 *
 * Flags accounts that share a wallet address, an IP hash, or a device id. This
 * is the `same-person` channel the Discord runs by hand: self-dealing and alt
 * accounts are an active problem, and one person on both sides of a deal is the
 * clearest case.
 *
 * ADMIN ONLY. These are signals, not findings — a shared IP can be a household
 * or a café. Never expose them publicly and never act on one without looking.
 */
export type AltFlag = {
  kind: 'wallet' | 'ip' | 'device';
  value: string;
  userIds: string[];
  handles: string[];
};

export async function findAltFlags(limit = 50): Promise<AltFlag[]> {
  const flags: AltFlag[] = [];

  // --- shared wallet addresses -------------------------------------------
  const wallets = await db.userWallet.findMany({
    select: { address: true, userId: true, user: { select: { displayName: true } } },
  });
  groupBy(wallets, (w) => w.address).forEach((rows, address) => {
    const ids = [...new Set(rows.map((r) => r.userId))];
    if (ids.length > 1) {
      flags.push({
        kind: 'wallet',
        value: address,
        userIds: ids,
        handles: rows.map((r) => r.user.displayName ?? 'unnamed'),
      });
    }
  });

  // --- shared IP / device hashes ------------------------------------------
  const users = await db.user.findMany({
    where: {
      OR: [{ lastSeenIpHash: { not: null } }, { lastSeenDeviceId: { not: null } }],
    },
    select: {
      id: true,
      displayName: true,
      lastSeenIpHash: true,
      lastSeenDeviceId: true,
    },
  });

  groupBy(
    users.filter((u) => u.lastSeenIpHash),
    (u) => u.lastSeenIpHash!,
  ).forEach((rows, hash) => {
    if (rows.length > 1) {
      flags.push({
        kind: 'ip',
        // Hashed, and only ever shown truncated — it is personal data held
        // solely for fraud review.
        value: `${hash.slice(0, 12)}…`,
        userIds: rows.map((r) => r.id),
        handles: rows.map((r) => r.displayName ?? 'unnamed'),
      });
    }
  });

  groupBy(
    users.filter((u) => u.lastSeenDeviceId),
    (u) => u.lastSeenDeviceId!,
  ).forEach((rows, device) => {
    if (rows.length > 1) {
      flags.push({
        kind: 'device',
        value: `${device.slice(0, 12)}…`,
        userIds: rows.map((r) => r.id),
        handles: rows.map((r) => r.displayName ?? 'unnamed'),
      });
    }
  });

  return flags.slice(0, limit);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
