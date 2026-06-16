/**
 * Replace broken /uploads/ image paths with real Cloudinary-hosted demo images.
 *
 *   node scripts/seed-demo-images.js
 *
 * Uploads one stock image per category to Cloudinary (once), then points every
 * DB record still referencing a /uploads/ path at the matching Cloudinary URL.
 * Idempotent-ish: re-running re-uploads and re-points (cheap, only ~5 images).
 */
require('dotenv').config();
const https = require('https');
const { MongoClient } = require('mongodb');
const { cloudinary } = require('../config/cloudinary');

// Stock images (Unsplash — free to use). One per visual category.
const SOURCES = {
  doctor:      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=600&q=80', // dentist portrait
  patient:     'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80', // person avatar
  clinic:      'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=800&q=80', // clinic interior
  certificate: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?w=800&q=80', // certificate/diploma
  beforeafter: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=800&q=80', // teeth/smile
};

const fetchBuffer = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });

const uploadBuffer = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'mydentist/demo', public_id: publicId, overwrite: true, resource_type: 'image' },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();
  const re = /^\/uploads\//;

  // 1. Upload one image per category to Cloudinary.
  console.log('Uploading demo images to Cloudinary…');
  const url = {};
  for (const [key, src] of Object.entries(SOURCES)) {
    const buf = await fetchBuffer(src);
    url[key] = await uploadBuffer(buf, `demo-${key}`);
    console.log(`  ✓ ${key} → ${url[key]}`);
  }

  // 2. Point broken records at the matching Cloudinary URLs.
  console.log('\nUpdating records…');
  const r1 = await db.collection('doctorprofiles').updateMany({ photo: re }, { $set: { photo: url.doctor } });
  console.log(`  doctor photos:    ${r1.modifiedCount}`);
  const r2 = await db.collection('patientprofiles').updateMany({ profileImage: re }, { $set: { profileImage: url.patient } });
  console.log(`  patient avatars:  ${r2.modifiedCount}`);

  // Gallery: choose image by category.
  const galleries = db.collection('galleries');
  const clinicCats = ['clinic_photos', 'clinic_photo'];
  const certCats = ['certificates', 'certificate'];

  const gc = await galleries.updateMany({ imageUrl: re, category: { $in: clinicCats } }, { $set: { imageUrl: url.clinic } });
  const gcert = await galleries.updateMany({ imageUrl: re, category: { $in: certCats } }, { $set: { imageUrl: url.certificate } });
  const gba = await galleries.updateMany({ imageUrl: re, category: 'before_after' }, { $set: { imageUrl: url.beforeafter } });
  // any remaining /uploads/ imageUrl → clinic as a safe default
  const grest = await galleries.updateMany({ imageUrl: re }, { $set: { imageUrl: url.clinic } });
  const gb = await galleries.updateMany({ beforeImage: re }, { $set: { beforeImage: url.beforeafter } });
  const ga = await galleries.updateMany({ afterImage: re }, { $set: { afterImage: url.beforeafter } });
  console.log(`  gallery clinic:   ${gc.modifiedCount}`);
  console.log(`  gallery certs:    ${gcert.modifiedCount}`);
  console.log(`  gallery b/a (main):${gba.modifiedCount}  before:${gb.modifiedCount}  after:${ga.modifiedCount}`);
  console.log(`  gallery other:    ${grest.modifiedCount}`);

  console.log('\nDone. Remaining /uploads/ references:',
    (await db.collection('doctorprofiles').countDocuments({ photo: re })) +
    (await db.collection('patientprofiles').countDocuments({ profileImage: re })) +
    (await galleries.countDocuments({ imageUrl: re })));
  await c.close();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
