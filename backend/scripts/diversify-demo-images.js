/**
 * Give each doctor/patient a DISTINCT demo portrait instead of the shared one.
 *
 *   node scripts/diversify-demo-images.js
 *
 * Uploads a pool of varied portraits to Cloudinary, then assigns them
 * per-record (matching gender for doctors where known). Only touches records
 * currently using the shared demo-doctor / demo-patient image.
 */
require('dotenv').config();
const https = require('https');
const { MongoClient } = require('mongodb');
const { cloudinary } = require('../config/cloudinary');

// Varied portrait pools (Unsplash, free). Enough to cover the record counts.
const POOLS = {
  doctorFemale: [
    'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=500&q=80',
    'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=500&q=80',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=500&q=80',
    'https://images.unsplash.com/photo-1638202993928-7267aad84c31?w=500&q=80',
    'https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=500&q=80',
  ],
  doctorMale: [
    'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=500&q=80',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=500&q=80',
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=500&q=80',
  ],
  patient: [
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&q=80',
    'https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80',
    'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?w=400&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80',
  ],
};

const fetchBuffer = (url) =>
  new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });

const upload = (buffer, publicId) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: 'mydentist/demo/portraits', public_id: publicId, overwrite: true },
        (err, r) => (err ? reject(err) : resolve(r.secure_url))
      )
      .end(buffer);
  });

async function uploadPool(name, urls) {
  const out = [];
  for (let i = 0; i < urls.length; i++) {
    const buf = await fetchBuffer(urls[i]);
    out.push(await upload(buf, `${name}-${i}`));
  }
  console.log(`  ✓ ${name}: ${out.length} portraits`);
  return out;
}

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const db = c.db();

  console.log('Uploading portrait pools to Cloudinary…');
  const female = await uploadPool('doctor-f', POOLS.doctorFemale);
  const male = await uploadPool('doctor-m', POOLS.doctorMale);
  const patient = await uploadPool('patient', POOLS.patient);

  console.log('\nAssigning distinct portraits…');
  // Doctors — match gender; default unspecified to female pool (larger).
  const docs = await db.collection('doctorprofiles').find({ photo: /demo-doctor/ }).toArray();
  let fi = 0, mi = 0;
  for (const d of docs) {
    const pool = d.gender === 'Male' ? male : female;
    const idx = d.gender === 'Male' ? mi++ : fi++;
    const photo = pool[idx % pool.length];
    await db.collection('doctorprofiles').updateOne({ _id: d._id }, { $set: { photo } });
  }
  console.log(`  doctors updated: ${docs.length}`);

  // Patients — round-robin the patient pool.
  const pats = await db.collection('patientprofiles').find({ profileImage: /demo-patient/ }).toArray();
  for (let i = 0; i < pats.length; i++) {
    await db.collection('patientprofiles').updateOne(
      { _id: pats[i]._id },
      { $set: { profileImage: patient[i % patient.length] } }
    );
  }
  console.log(`  patients updated: ${pats.length}`);

  console.log('\nDone — each account now has a distinct portrait.');
  await c.close();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
