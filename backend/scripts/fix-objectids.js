/**
 * Repair migration damage: convert string _id and reference fields back to
 * real BSON ObjectIds.
 *
 * The JSON backup/restore inserted _id and ref fields as plain strings, so
 * Mongoose's findById/populate (which cast to ObjectId) fail to match.
 * This rewrites every affected document with proper ObjectIds.
 *
 *   node scripts/fix-objectids.js
 *
 * Strategy: for each collection, read all docs, and for any doc whose _id (or
 * a known ref field) is a string that looks like an ObjectId, re-insert a
 * corrected copy. Because _id is immutable, we drop+reinsert per collection
 * inside the same run. Idempotent: docs already using ObjectId are left as-is.
 */
require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

// ObjectId reference fields per collection (from the Mongoose models).
const REF_FIELDS = {
  appointments: ['patientId', 'doctorId'],
  bills: ['appointmentId', 'patientId', 'doctorId'],
  chatmessages: ['senderId', 'receiverId'],
  doctorprofiles: ['userId'],
  favorites: ['patientId', 'doctorId'],
  galleries: ['doctorId'],
  notifications: ['userId'],
  patientprofiles: ['userId'],
  paymentmethods: ['userId'],
  reviews: ['patientId', 'doctorId'],
  rewards: ['patientId'],
  treatments: ['doctorId'],
  users: [],
};

const isOidString = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const toOid = (v) => (isOidString(v) ? new ObjectId(v) : v);

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  console.log(`DB: ${db.databaseName}\n`);

  for (const [name, refs] of Object.entries(REF_FIELDS)) {
    const col = db.collection(name);
    const docs = await col.find({}).toArray();
    if (!docs.length) {
      console.log(`  – ${name.padEnd(16)} empty, skipped`);
      continue;
    }

    // Does this collection need fixing? (any string _id or string ref)
    const needsFix = docs.some(
      (d) => isOidString(d._id) || refs.some((f) => isOidString(d[f]))
    );
    if (!needsFix) {
      console.log(`  ✓ ${name.padEnd(16)} already ObjectIds, skipped`);
      continue;
    }

    const fixed = docs.map((d) => {
      const copy = { ...d };
      copy._id = toOid(d._id);
      for (const f of refs) {
        if (d[f] != null) copy[f] = toOid(d[f]);
      }
      return copy;
    });

    // Replace collection contents atomically-ish: drop then reinsert.
    await col.deleteMany({});
    await col.insertMany(fixed);
    console.log(`  ↻ ${name.padEnd(16)} fixed ${fixed.length} docs`);
  }

  console.log('\nDone. Verifying a sample lookup…');
  const sample = await db.collection('doctorprofiles').findOne({});
  console.log('  doctorprofiles._id is ObjectId:', sample?._id?._bsontype === 'ObjectId');
  await c.close();
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
