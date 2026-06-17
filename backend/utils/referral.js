const crypto = require('crypto');
const PatientProfile = require('../models/PatientProfile');
const Reward = require('../models/Reward');

const REFERRAL_POINTS = 100;

// Generate a short unique referral code (e.g. MD7F3A2B).
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

/**
 * Award the referral bonus (100 each) to the referred patient and their
 * referrer — once, after the referred patient's first completed treatment.
 */
async function rewardReferralOnFirstTreatment(patientProfile) {
  if (!patientProfile || patientProfile.referralRewarded || !patientProfile.referredBy) return;

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

  patientProfile.referralRewarded = true;
  await patientProfile.save();
}

module.exports = { generateReferralCode, ensureReferralCode, rewardReferralOnFirstTreatment, REFERRAL_POINTS };
