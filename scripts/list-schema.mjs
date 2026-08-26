import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const t = await c.query(`
  SELECT c.relname AS table,
         (SELECT count(*) FROM information_schema.columns col
           WHERE col.table_name = c.relname AND col.table_schema='public') AS cols,
         (SELECT count(*) FROM pg_index i WHERE i.indrelid = c.oid) AS idx
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;`);
console.log('TABLES');
for (const r of t.rows) console.log(`  ${r.table.padEnd(22)} ${String(r.cols).padStart(2)} cols  ${String(r.idx).padStart(2)} indexes`);
console.log(`  (${t.rows.length} tables)`);

const e = await c.query(`
  SELECT t.typname, count(*) AS vals FROM pg_type t
  JOIN pg_enum en ON en.enumtypid=t.oid
  JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'
  GROUP BY t.typname ORDER BY t.typname;`);
console.log('\nENUM TYPES');
console.log('  ' + e.rows.map(r => `${r.typname}(${r.vals})`).join(', '));

const ck = await c.query(`
  SELECT conrelid::regclass AS tbl, conname FROM pg_constraint
  WHERE contype='c' AND connamespace='public'::regnamespace ORDER BY 1,2;`);
console.log('\nCHECK CONSTRAINTS');
for (const r of ck.rows) console.log(`  ${String(r.tbl).padEnd(16)} ${r.conname}`);

const tg = await c.query(`
  SELECT tgrelid::regclass AS tbl, tgname FROM pg_trigger
  WHERE NOT tgisinternal ORDER BY 1,2;`);
console.log('\nTRIGGERS');
for (const r of tg.rows) console.log(`  ${String(r.tbl).padEnd(16)} ${r.tgname}`);

const m = await c.query(`SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at;`);
console.log('\nAPPLIED MIGRATIONS');
for (const r of m.rows) console.log(`  ${r.migration_name}  ${r.finished_at ? 'applied' : 'PENDING'}`);

await c.end();
