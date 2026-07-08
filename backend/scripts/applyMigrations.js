// Apply Prisma migrations WITHOUT the Prisma CLI — using only the query engine
// (the pre-generated client). Fallback for hosts where the Prisma CLI can't run
// (WASM steps get OOM-killed on CloudLinux) or where `prisma migrate deploy`'s
// advisory lock collides with Passenger booting the app more than once.
//
// Concurrency-safe: the whole apply runs inside ONE transaction that first takes
// a transaction-scoped Postgres advisory lock, so simultaneous app instances
// serialize — the loser waits, then sees the migrations already recorded in
// `_prisma_migrations` and no-ops. Our migrations are plain DDL (no functions/DO
// blocks), so each migration.sql is executed statement-by-statement.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const prisma = require('../config/prisma');

// Arbitrary fixed key so all instances contend on the same advisory lock.
const LOCK_KEY = 727073690;

module.exports = async function applyMigrations() {
  const dir = path.join(__dirname, '..', 'prisma', 'migrations');
  if (!fs.existsSync(dir)) {
    console.error('[migrate] no migrations directory — skipping');
    return;
  }

  const folders = fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isDirectory())
    .sort(); // timestamp-prefixed → chronological

  // Prisma's bookkeeping table (idempotent). Wrapped because two instances doing
  // CREATE TABLE IF NOT EXISTS at once can rarely race on the system catalog.
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      );
    `);
  } catch (e) {
    console.error('[migrate] _prisma_migrations ensure note:', e.message);
  }

  await prisma.$transaction(
    async (tx) => {
      // Serialize concurrent boots; auto-released on commit/rollback.
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${LOCK_KEY})`);

      const rows = await tx.$queryRawUnsafe(
        `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;`
      );
      const done = new Set(rows.map((r) => r.migration_name));

      let appliedAny = false;
      for (const name of folders) {
        if (done.has(name)) continue;
        const sqlPath = path.join(dir, name, 'migration.sql');
        if (!fs.existsSync(sqlPath)) continue;

        const sql = fs.readFileSync(sqlPath, 'utf8');
        const statements = sql
          .split(/;\s*(?:\r?\n|$)/)
          .map((s) => s.trim())
          .filter((s) => s && s.replace(/^\s*--.*$/gm, '').trim());

        console.error(`[migrate] applying ${name} (${statements.length} statements) …`);
        for (const stmt of statements) {
          await tx.$executeRawUnsafe(stmt);
        }
        await tx.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), $4)`,
          randomUUID(),
          'applied-by-bootstrap',
          name,
          statements.length
        );
        console.error(`[migrate] ${name} ✓`);
        appliedAny = true;
      }

      console.error(appliedAny ? '[migrate] migrations applied ✓' : '[migrate] up to date ✓');
    },
    { timeout: 120000, maxWait: 120000 }
  );
};
