const crypto = require('crypto');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Reward = require('../models/Reward');

const REFERRAL_POINTS = 100;

// ── Patient referral code (prefix "MD", e.g. MD7F3A2B) ──
async function generateReferralCode() {
  for (let i = 0; i < 6; i++) {
    const code = 'MD' + crypto.randomBytes(3).toString('hex').toUpperCase();
    if (!(await PatientProfile.findOne({ referralCode: code }))) return code;
  }
  return 'MD' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Ensure a patient has a referral code; returns it.
async function ensureReferralCode(patientProfile) {
  if (!patientProfile.referralCode) {
    patientProfile.referralCode = await generateReferralCode();
    await patientProfile.save();
  }
  return patientProfile.referralCode;
}

// ── Doctor referral code (prefix "DR" so it never collides with patient "MD" codes) ──
async function generateDoctorReferralCode() {
  for (let i = 0; i < 6; i++) {
    const code = 'DR' + crypto.randomBytes(3).toString('hex').toUpperCase();
    if (!(await DoctorProfile.findOne({ referralCode: code }))) return code;
  }
  return 'DR' + Date.now().toString(36).toUpperCase().slice(-6);
}

// Ensure a doctor has a referral code; returns it.
async function ensureDoctorReferralCode(doctorProfile) {
  if (!doctorProfile.referralCode) {
    doctorProfile.referralCode = await generateDoctorReferralCode();
    await doctorProfile.save();
  }
  return doctorProfile.referralCode;
}

/**
 * Award the referral bonus (100 each) after a referred PATIENT's first completed
 * treatment — once. The referrer may be another patient OR a doctor:
 *   - patient referrer → 100 pts on the referrer's Reward ledger
 *   - doctor referrer  → 100 pts on the referrer doctor's rewardPoints
 * The referred patient always earns 100 pts on their Reward ledger.
 */
async function rewardReferralOnFirstTreatment(patientProfile) {
  if (!patientProfile || patientProfile.referralRewarded || !patientProfile.referredBy) return;

  const referredByDoctor = patientProfile.referredByModel === 'DoctorProfile';

  if (referredByDoctor) {
    const referrer = await DoctorProfile.findById(patientProfile.referredBy);
    if (!referrer) return;
    // Referred patient earns points on their ledger.
    await Reward.create({
      patientId: patientProfile._id,
      type: 'referral',
      points: REFERRAL_POINTS,
      description: 'Referral bonus — joined via a dentist and completed first treatment',
    });
    // Referrer doctor earns reward points (drives the Popular badge).
    const { addDoctorPoints } = require('./popular');
    await addDoctorPoints(referrer._id, REFERRAL_POINTS, {
      kind: 'referral',
      note: `Referral bonus — ${patientProfile.fullName || 'a patient'} joined via your code and completed their first treatment`,
    });
  } else {
    const referrer = await PatientProfile.findById(patientProfile.referredBy);
    if (!referrer) return;
    await Reward.create({
      patientId: patientProfile._id,
      type: 'referral',
      points: REFERRAL_POINTS,
      description: 'Referral bonus — joined and completed first treatment',
    });
    await Reward.create({
      patientId: referrer._id,
      type: 'referral',
      points: REFERRAL_POINTS,
      description: `Referral bonus — ${patientProfile.fullName || 'a friend'} you referred completed their first treatment`,
    });
  }

  patientProfile.referralRewarded = true;
  await patientProfile.save();
}

/**
 * Award the doctor→doctor referral bonus (100 each) after the referred DOCTOR's
 * first completed patient treatment — once. Both doctors' rewardPoints increment.
 *
 * We do NOT `.save()` the passed-in doctorProfile — addDoctorPoints uses an atomic
 * $inc, and saving a stale doc here would clobber that increment. Instead we
 * atomically claim the reward flag, then increment both doctors' points.
 */
async function rewardDoctorReferralOnFirstTreatment(doctorProfile) {
  if (!doctorProfile || doctorProfile.referralRewarded || !doctorProfile.referredBy) return;

  // Atomically claim so the bonus can only ever pay out once.
  const claimed = await DoctorProfile.findOneAndUpdate(
    { _id: doctorProfile._id, referralRewarded: { $ne: true }, referredBy: { $ne: null } },
    { $set: { referralRewarded: true } },
    { new: true }
  );
  if (!claimed) return; // already rewarded

  const referrer = await DoctorProfile.findById(claimed.referredBy);
  if (!referrer) return;

  const { addDoctorPoints } = require('./popular');
  await addDoctorPoints(claimed._id, REFERRAL_POINTS, {   // referred doctor
    kind: 'referral',
    note: 'Referral bonus — you joined via a dentist referral and completed your first treatment',
  });
  await addDoctorPoints(referrer._id, REFERRAL_POINTS, {  // referrer doctor
    kind: 'referral',
    note: `Referral bonus — ${claimed.fullName || 'a dentist'} you referred completed their first treatment`,
  });

  doctorProfile.referralRewarded = true; // reflect in the caller's copy
}

module.exports = {
  generateReferralCode,
  ensureReferralCode,
  generateDoctorReferralCode,
  ensureDoctorReferralCode,
  rewardReferralOnFirstTreatment,
  rewardDoctorReferralOnFirstTreatment,
  REFERRAL_POINTS,
};
