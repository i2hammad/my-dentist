const crypto = require('crypto');
const prisma = require('../config/prisma');

const REFERRAL_POINTS = 100;

// ── Patient referral code (prefix "MD") ──
async function generateReferralCode() {
  for (let i = 0; i < 6; i++) {
    const code = 'MD' + crypto.randomBytes(3).toString('hex').toUpperCase();
    if (!(await prisma.patientProfile.findFirst({ where: { referralCode: code } }))) return code;
  }
  return 'MD' + Date.now().toString(36).toUpperCase().slice(-6);
}

async function ensureReferralCode(patientProfile) {
  if (!patientProfile.referralCode) {
    const code = await generateReferralCode();
    await prisma.patientProfile.update({ where: { id: patientProfile.id }, data: { referralCode: code } });
    patientProfile.referralCode = code;
  }
  return patientProfile.referralCode;
}

// ── Doctor referral code (prefix "DR") ──
async function generateDoctorReferralCode() {
  for (let i = 0; i < 6; i++) {
    const code = 'DR' + crypto.randomBytes(3).toString('hex').toUpperCase();
    if (!(await prisma.doctorProfile.findFirst({ where: { referralCode: code } }))) return code;
  }
  return 'DR' + Date.now().toString(36).toUpperCase().slice(-6);
}

async function ensureDoctorReferralCode(doctorProfile) {
  if (!doctorProfile.referralCode) {
    const code = await generateDoctorReferralCode();
    await prisma.doctorProfile.update({ where: { id: doctorProfile.id }, data: { referralCode: code } });
    doctorProfile.referralCode = code;
  }
  return doctorProfile.referralCode;
}

/**
 * Award the referral bonus (100 each) after a referred PATIENT's first completed
 * treatment — once. Referrer may be another patient OR a doctor.
 */
async function rewardReferralOnFirstTreatment(patientProfile) {
  if (!patientProfile || patientProfile.referralRewarded || !patientProfile.referredBy) return;

  const referredByDoctor = patientProfile.referredByModel === 'DoctorProfile';

  if (referredByDoctor) {
    const referrer = await prisma.doctorProfile.findUnique({ where: { id: patientProfile.referredBy } });
    if (!referrer) return;
    await prisma.reward.create({
      data: {
        patientId: patientProfile.id,
        type: 'referral',
        points: REFERRAL_POINTS,
        description: 'Referral bonus — joined via a dentist and completed first treatment',
      },
    });
    const { addDoctorPoints } = require('./popular');
    await addDoctorPoints(referrer.id, REFERRAL_POINTS, {
      kind: 'referral',
      note: `Referral bonus — ${patientProfile.fullName || 'a patient'} joined via your code and completed their first treatment`,
    });
  } else {
    const referrer = await prisma.patientProfile.findUnique({ where: { id: patientProfile.referredBy } });
    if (!referrer) return;
    await prisma.reward.create({
      data: {
        patientId: patientProfile.id,
        type: 'referral',
        points: REFERRAL_POINTS,
        description: 'Referral bonus — joined and completed first treatment',
      },
    });
    await prisma.reward.create({
      data: {
        patientId: referrer.id,
        type: 'referral',
        points: REFERRAL_POINTS,
        description: `Referral bonus — ${patientProfile.fullName || 'a friend'} you referred completed their first treatment`,
      },
    });
  }

  await prisma.patientProfile.update({ where: { id: patientProfile.id }, data: { referralRewarded: true } });
  patientProfile.referralRewarded = true;
}

/**
 * Award the doctor→doctor referral bonus (100 each) after the referred DOCTOR's
 * first completed patient treatment — once. Atomically claims the flag first.
 */
async function rewardDoctorReferralOnFirstTreatment(doctorProfile) {
  if (!doctorProfile || doctorProfile.referralRewarded || !doctorProfile.referredBy) return;

  // Atomic claim: only succeeds once.
  const claim = await prisma.doctorProfile.updateMany({
    where: { id: doctorProfile.id, referralRewarded: false, referredBy: { not: null } },
    data: { referralRewarded: true },
  });
  if (claim.count === 0) return; // already rewarded

  const claimed = await prisma.doctorProfile.findUnique({ where: { id: doctorProfile.id } });
  if (!claimed) return;
  const referrer = await prisma.doctorProfile.findUnique({ where: { id: claimed.referredBy } });
  if (!referrer) return;

  const { addDoctorPoints } = require('./popular');
  await addDoctorPoints(claimed.id, REFERRAL_POINTS, {
    kind: 'referral',
    note: 'Referral bonus — you joined via a dentist referral and completed your first treatment',
  });
  await addDoctorPoints(referrer.id, REFERRAL_POINTS, {
    kind: 'referral',
    note: `Referral bonus — ${claimed.fullName || 'a dentist'} you referred completed their first treatment`,
  });

  doctorProfile.referralRewarded = true;
}

/**
 * Award referral bonuses for a completed treatment — the patient/doctor "first
 * completed treatment" referral payouts. Call this wherever an appointment
 * transitions to `completed`: when its bill is finalized (bill controller) OR via
 * the direct /complete endpoint. Idempotent — the underlying helpers no-op once
 * already rewarded. Non-fatal on error.
 *
 * NOTE: this covers ONLY referral bonuses; per-appointment/per-bill doctor points
 * are granted separately by their own callers (so nothing is double-counted).
 *
 * @param {string} doctorProfileId
 * @param {string} patientProfileId
 */
async function awardReferralOnCompletion(doctorProfileId, patientProfileId) {
  try {
    if (patientProfileId) {
      const p = await prisma.patientProfile.findUnique({ where: { id: patientProfileId } });
      await rewardReferralOnFirstTreatment(p);
    }
    if (doctorProfileId) {
      const d = await prisma.doctorProfile.findUnique({ where: { id: doctorProfileId } });
      await rewardDoctorReferralOnFirstTreatment(d);
    }
  } catch (e) {
    console.error('awardReferralOnCompletion error (non-fatal):', e.message);
  }
}

module.exports = {
  generateReferralCode,
  ensureReferralCode,
  generateDoctorReferralCode,
  ensureDoctorReferralCode,
  rewardReferralOnFirstTreatment,
  rewardDoctorReferralOnFirstTreatment,
  awardReferralOnCompletion,
  REFERRAL_POINTS,
};
