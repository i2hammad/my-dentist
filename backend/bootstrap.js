// ─── cPanel / CloudLinux Node.js Selector boot shim ─────────────────────────
// This host can't run the Prisma CLI reliably (the WASM schema/engine steps get
// OOM-killed under CloudLinux LVE) and gives no shell. So:
//   • the Prisma CLIENT is pre-generated and shipped in ./generated/prisma
//     (see prisma/schema.prisma output), meaning NO `prisma generate` on boot;
//   • MIGRATIONS are applied at boot — first trying `prisma migrate deploy`,
//     then falling back to a raw-SQL applier that uses only the query engine
//     (scripts/applyMigrations.js) if the CLI can't run;
//   • the super-admin is created from ADMIN_EMAIL / ADMIN_PASSWORD.
// Set this file as the app's "Application startup file" in cPanel. All steps
// log with a [bootstrap] prefix to the app log.

try { require('dotenv').config(); } catch (_) {}

(async () => {
  // 1) Apply any pending migrations using ONLY the query engine (fast — a couple
  //    of quick queries that no-op once up to date). We do NOT run
  //    `prisma migrate deploy` here: its schema-engine spin-up made EVERY cold
  //    start slow (lsnode re-spawns the app often), which could stall uploads and
  //    other requests. The pre-generated client already ships the query engine.
  try {
    await require('./scripts/applyMigrations')();
  } catch (e) {
    console.error('[bootstrap] migration apply FAILED:', e.message);
  }

  // 2) Ensure a super-admin exists (best-effort; controlled by env vars).
  try {
    await require('./scripts/ensureAdmin')();
  } catch (e) {
    console.error('[bootstrap] ensureAdmin skipped:', e.message);
  }

  // 3) Start the API (listens on process.env.PORT provided by Passenger).
  require('./server.js');
})();
