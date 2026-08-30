import 'dotenv/config';
import { db } from '../lib/db';

async function main() {
  // Warm the pool so the first connection's TLS handshake is not counted.
  await db.$queryRaw`SELECT 1`;

  const time = async (label: string, fn: () => Promise<unknown>) => {
    const t = performance.now();
    await fn();
    return `${label.padEnd(28)} ${(performance.now() - t).toFixed(1)}ms`;
  };

  console.log(await time('1 trivial query', () => db.$queryRaw`SELECT 1`));
  console.log(await time('1 trivial query (repeat)', () => db.$queryRaw`SELECT 1`));

  for (const n of [2, 4, 6, 8]) {
    console.log(await time(`${n} trivial queries in parallel`, () =>
      Promise.all(Array.from({ length: n }, () => db.$queryRaw`SELECT 1`)),
    ));
  }
  for (const n of [2, 6]) {
    console.log(await time(`${n} trivial queries in series`, async () => {
      for (let i = 0; i < n; i++) await db.$queryRaw`SELECT 1`;
    }));
  }
}

main().finally(() => db.$disconnect());
