/**
 * Dump every collection from the source MongoDB to local JSON files.
 *
 *   node scripts/db-backup.js
 *
 * Reads MONGODB_URI from .env. Writes one <collection>.json file per
 * collection into ./db-backup/ (gitignored). Safe to re-run (overwrites).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const OUT_DIR = path.join(__dirname, '..', 'db-backup');

(async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const cols = await db.listCollections().toArray();
    console.log(`Source DB: ${db.databaseName} — ${cols.length} collections\n`);

    let total = 0;
    for (const { name } of cols) {
      const docs = await db.collection(name).find({}).toArray();
      fs.writeFileSync(
        path.join(OUT_DIR, `${name}.json`),
        JSON.stringify(docs, null, 2)
      );
      console.log(`  ✓ ${name.padEnd(20)} ${docs.length} docs`);
      total += docs.length;
    }
    console.log(`\nBackup complete: ${total} documents → ${OUT_DIR}`);
  } catch (e) {
    console.error('Backup failed:', e.message);
    process.exit(1);
  } finally {
    await client.close();
  }
})();
