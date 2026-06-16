/**
 * Restore the ORIGINAL uploaded images from the recovered uploads/ folder.
 *
 *   UPLOADS_DIR=/tmp/old-uploads/uploads node scripts/restore-real-images.js
 *
 * For each record, read its ORIGINAL /uploads/... path from the db-backup JSON,
 * find that file on disk, upload it to Cloudinary, and point the CURRENT DB
 * record (matched by _id) at the real Cloudinary URL. Records whose file isn't
 * present are left on their current (demo) image and reported.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { cloudinary } = require('../config/cloudinary');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join('/tmp/old-uploads/uploads');
const BACKUP_DIR = path.join(__dirname, '..', 'db-backup');

// Which collections/fields hold an image path, and the Cloudinary folder to use.
const TARGETS = [
  { coll: 'doctorprofiles', field: 'photo', folder: 'mydentist/avatars' },
  { coll: 'patientprofiles', field: 'profileImage', folder: 'mydentist/avatars' },
  { coll: 'galleries', field: 'imageUrl', folder: 'mydentist/gallery' },
  { coll: 'galleries', field: 'beforeImage', folder: 'mydentist/gallery' },
  { coll: 'galleries', field: 'afterImage', folder: 'mydentist/gallery' },
];

const localFileFor = (uploadPath) => {
  // uploadPath like "/uploads/avatar-xxx.jpg" or "/uploads/gallery/clinic3.jpg"
  const rel = uploadPath.replace(/^\/?uploads\//, '');
  const p = path.join(UPLOADS_DIR, rel);
  return fs.existsSync(p) ? p : null;
};

const uploadFile = (filePath, folder) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      filePath,
      { folder, resource_type: 'image' },
      (err, r) => (err ? reject(err) : resolve(r.secure_url))
    );
  });

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  const cache = {}; // local path -> cloudinary url (dedupe uploads)
  let restored = 0, missing = 0;
  const missingFiles = new Set();

  for (const { coll, field, folder } of TARGETS) {
    const backupPath = path.join(BACKUP_DIR, `${coll}.json`);
    if (!fs.existsSync(backupPath)) continue;
    const backupDocs = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    for (const doc of backupDocs) {
      const orig = doc[field];
      if (!orig || !/^\/?uploads\//.test(orig)) continue; // not an uploads path

      const local = localFileFor(orig);
      if (!local) { missing++; missingFiles.add(orig); continue; }

      let url = cache[local];
      if (!url) {
        url = await uploadFile(local, folder);
        cache[local] = url;
      }
      await db.collection(coll).updateOne(
        { _id: new ObjectId(doc._id) },
        { $set: { [field]: url } }
      );
      restored++;
    }
  }

  console.log(`\nRestored ${restored} real images (${Object.keys(cache).length} unique files uploaded).`);
  console.log(`Missing files (kept on demo image): ${missing}`);
  if (missingFiles.size) {
    console.log('  e.g.', [...missingFiles].slice(0, 5).join('\n       '));
  }
  await c.close();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
