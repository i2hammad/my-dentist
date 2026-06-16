/**
 * Restore the local JSON backup into a TARGET MongoDB (your own cluster).
 *
 *   TARGET_MONGODB_URI="mongodb+srv://...your-new-cluster.../Med_App" node scripts/db-restore.js
 *
 * Reads ./db-backup/*.json and inserts into the target DB. By default it
 * REFUSES to run against a non-empty collection (so you can't clobber data
 * by accident). Pass --force to drop+replace existing collections.
 */
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const IN_DIR = path.join(__dirname, '..', 'db-backup');
const FORCE = process.argv.includes('--force');

(async () => {
  const uri = process.env.TARGET_MONGODB_URI;
  if (!uri) {
    console.error('Set TARGET_MONGODB_URI to your NEW cluster connection string.');
    console.error('  TARGET_MONGODB_URI="mongodb+srv://..." node scripts/db-restore.js');
    process.exit(1);
  }
  if (!fs.existsSync(IN_DIR)) {
    console.error(`No backup found at ${IN_DIR}. Run db-backup.js first.`);
    process.exit(1);
  }

  const files = fs.readdirSync(IN_DIR).filter((f) => f.endsWith('.json'));
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    console.log(`Target DB: ${db.databaseName}${FORCE ? '  (--force: will drop existing)' : ''}\n`);

    let total = 0;
    for (const file of files) {
      const name = path.basename(file, '.json');
      const docs = JSON.parse(fs.readFileSync(path.join(IN_DIR, file), 'utf8'));
      const col = db.collection(name);

      const existing = await col.countDocuments();
      if (existing > 0) {
        if (!FORCE) {
          console.log(`  ⚠ skip ${name} — ${existing} docs already present (use --force to replace)`);
          continue;
        }
        await col.drop();
      }
      if (docs.length) {
        await col.insertMany(docs);
      }
      console.log(`  ✓ ${name.padEnd(20)} ${docs.length} docs`);
      total += docs.length;
    }
    console.log(`\nRestore complete: ${total} documents → ${db.databaseName}`);
  } catch (e) {
    console.error('Restore failed:', e.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
