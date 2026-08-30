import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * TEMPORARY INSTRUMENTATION — measuring only, changes no behaviour.
 *
 * Counts Prisma queries and their durations per render, so "how many queries
 * does this page run" is a number rather than a guess.
 *
 * `AsyncLocalStorage` rather than a module-level counter: the server handles
 * requests concurrently, and a shared counter would mix two renders together
 * and quietly report nonsense. The store follows one async call tree.
 */
export type QueryRecord = { sql: string; ms: number };

type Collector = { label: string; queries: QueryRecord[]; startedAt: number };

/**
 * Pinned to globalThis for the same reason the Prisma client is: in dev, HMR
 * evaluates this module more than once, and a plain module-level constant then
 * gives the Prisma event listener in lib/db.ts a *different* AsyncLocalStorage
 * object from the one the page's `withQueryLog` is running inside. The store
 * lookup silently returns undefined and every block reports zero queries —
 * which is exactly what happened before this was pinned.
 */
const globalForQueryLog = globalThis as unknown as {
  queryLogStorage?: AsyncLocalStorage<Collector>;
};

const storage =
  globalForQueryLog.queryLogStorage ?? new AsyncLocalStorage<Collector>();

globalForQueryLog.queryLogStorage = storage;

/** Called by the Prisma `query` event listener in lib/db.ts. */
export function recordQuery(sql: string, ms: number) {
  storage.getStore()?.queries.push({ sql, ms });
}

export function isCollecting() {
  return storage.getStore() !== undefined;
}

/** Trim a SQL string to something readable in a terminal. */
function shorten(sql: string, max = 110) {
  const flat = sql.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/**
 * Runs `fn` with a collector active, then prints what happened.
 *
 * Wall time is reported alongside DB time because the difference is the point:
 * queries issued in parallel add up to more DB time than the request actually
 * spent waiting, and queries issued in sequence do not.
 */
export async function withQueryLog<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const collector: Collector = { label, queries: [], startedAt: performance.now() };

  return storage.run(collector, async () => {
    try {
      return await fn();
    } finally {
      const wall = performance.now() - collector.startedAt;
      const total = collector.queries.reduce((n, q) => n + q.ms, 0);
      const n = collector.queries.length;

      const lines = [
        '',
        `┌─ ${label}`,
        `│  ${n} quer${n === 1 ? 'y' : 'ies'}, ${total.toFixed(1)}ms of DB time, ${wall.toFixed(1)}ms wall`,
        '│',
      ];
      collector.queries
        .map((q, i) => ({ ...q, i }))
        .sort((a, b) => b.ms - a.ms)
        .forEach((q) => {
          lines.push(`│  ${String(q.ms.toFixed(1)).padStart(7)}ms  #${q.i + 1}  ${shorten(q.sql)}`);
        });
      lines.push('└─');
      console.log(lines.join('\n'));
    }
  });
}
