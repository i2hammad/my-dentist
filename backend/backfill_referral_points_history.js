/**
 * One-off backfill: create pointsAdjustments line items for referral bonuses
 * that were paid out BEFORE the ledger existed.
 *
 * Background: referral bonuses (100 pts) used to only `$inc` a doctor's
 * rewardPoints with no history record, so they show in the top-line total but
 * never as a line item in the Points History screen. Real-time payouts now
 * write a `pointsAdjustments` entry (kind: 'referral'); this script fills the
 * historical gap for referrals that already paid out.
 *
 * It is IDEMPOTENT: entries are matched by (kind='referral' + exact note), which
 * are the same notes the live code writes — so running it twice, or running it
 * against doctors that already have real-time entries, adds nothing new.
 *
 * Usage (from Combined Backend / backend root):
 *   node backfill_referral_points_history.js            # DRY RUN — prints what it would add
 *   node backfill_referral_points_history.js --apply    # actually writes
 *
 * Note on dates: the original payout timestamp was never stored, so each
 * backfilled entry is dated to the referred party's `updatedAt` (best-effort
 * approximation, good enough to land it in the right month).
 */
const mongoose = require('mongoose');
require('dotenv').config();

const PatientProfile = require('./models/PatientProfile');
const DoctorProfile = require('./models/DoctorProfile');

const REFERRAL_POINTS = 100;
const APPLY = process.argv.includes('--apply');
const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;

// Same note strings the live code (utils/referral.js) writes, so matching on
// them makes the backfill idempotent against already-created real-time entries.
const notePatientReferrer = (patientName) =>
  `Referral bonus — ${patientName || 'a patient'} joined via your code and completed their first treatment`;
const noteDoctorReferred =
  'Referral bonus — you joined via a dentist referral and completed your first treatment';
const noteDoctorReferrer = (doctorName) =>
  `Referral bonus — ${doctorName || 'a dentist'} you referred completed their first treatment`;

async function main() {
  if (!MONGO) {
    console.error('❌ No Mongo connection string in env (MONGODB_URI / MONGO_URI).');
    process.exit(1);
  }
  await mongoose.connect(MONGO);
  console.log(`✅ Connected. Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`);

  // Cache doctors we touch so multiple pushes to the same doctor accumulate
  // before a single save, and so idempotency checks see prior pushes this run.
  const docCache = new Map(); // id -> DoctorProfile doc
  const getDoctor = async (id) => {
    const key = String(id);
    if (!docCache.has(key)) {
      const d = await DoctorProfile.findById(id);
      if (d && !Array.isArray(d.pointsAdjustments)) d.pointsAdjustments = [];
      docCache.set(key, d);
    }
    return docCache.get(key);
  };

  let planned = 0;

  // Push one referral entry onto a doctor if an identical one isn't already there.
  const addEntry = (doctor, { points, note, date, label }) => {
    if (!doctor) return;
    const exists = (doctor.pointsAdjustments || []).some(
      (pa) => pa.kind === 'referral' && pa.note === note
    );
    if (exists) return; // already recorded (live entry or a prior run) — skip
    doctor.pointsAdjustments.push({ points, note, kind: 'referral', createdAt: date });
    planned++;
    console.log(`  + ${label}: +${points} → doctor ${doctor._id} (${doctor.fullName || 'Doctor'})`);
  };

  // ── 1. Patient → doctor referrals (referrer doctor earned 100) ──
  const referredPatients = await PatientProfile.find({
    referralRewarded: true,
    referredByModel: 'DoctorProfile',
    referredBy: { $ne: null },
  }).select('fullName referredBy updatedAt createdAt');

  console.log(`Patient→doctor rewarded referrals: ${referredPatients.length}`);
  for (const p of referredPatients) {
    const doctor = await getDoctor(p.referredBy);
    if (!doctor) continue;
    addEntry(doctor, {
      points: REFERRAL_POINTS,
      note: notePatientReferrer(p.fullName),
      date: p.updatedAt || p.createdAt || new Date(),
      label: `patient "${p.fullName || '—'}" referral`,
    });
  }

  // ── 2. Doctor → doctor referrals (referred doctor + referrer doctor each earned 100) ──
  const referredDoctors = await DoctorProfile.find({
    referralRewarded: true,
    referredBy: { $ne: null },
  }).select('fullName referredBy updatedAt createdAt');

  console.log(`Doctor→doctor rewarded referrals: ${referredDoctors.length}`);
  for (const d of referredDoctors) {
    // The referred doctor themselves earned 100.
    const referred = await getDoctor(d._id);
    addEntry(referred, {
      points: REFERRAL_POINTS,
      note: noteDoctorReferred,
      date: d.updatedAt || d.createdAt || new Date(),
      label: `referred doctor "${d.fullName || '—'}" self-bonus`,
    });
    // The referrer doctor earned 100.
    const referrer = await getDoctor(d.referredBy);
    addEntry(referrer, {
      points: REFERRAL_POINTS,
      note: noteDoctorReferrer(d.fullName),
      date: d.updatedAt || d.createdAt || new Date(),
      label: `referrer of doctor "${d.fullName || '—'}"`,
    });
  }

  console.log(`\n${planned} ledger entr${planned === 1 ? 'y' : 'ies'} to add across ${docCache.size} doctor(s).`);

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to persist.');
    await mongoose.disconnect();
    process.exit(0);
  }

  let saved = 0;
  for (const doctor of docCache.values()) {
    if (!doctor) continue;
    if (doctor.isModified && doctor.isModified('pointsAdjustments')) {
      await doctor.save();
      saved++;
    }
  }
  console.log(`\n✅ Applied. Saved ${saved} doctor document(s).`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});
