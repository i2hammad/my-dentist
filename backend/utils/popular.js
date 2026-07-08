const prisma = require('../config/prisma');

const DEFAULT_THRESHOLD = 20000;

async function getThreshold() {
  const s = await prisma.appSettings.findUnique({ where: { key: 'global' }, select: { popularPointsThreshold: true } });
  return s?.popularPointsThreshold ?? DEFAULT_THRESHOLD;
}

/**
 * Recompute a doctor's popular status from their reward points.
 *  - Paid (blue) status is admin-granted and is NEVER auto-removed here.
 *  - Reaching the points threshold grants earned (green) status.
 *  - Dropping below the threshold removes ONLY earned status (not paid).
 *
 * @param {object} doctor a fresh DoctorProfile row (must include rewardPoints/popularType/isPopular/id)
 */
async function recomputePopular(doctor) {
  if (!doctor) return doctor;
  if (doctor.popularType === 'paid') return doctor; // paid stays paid

  const threshold = await getThreshold();
  let data = null;
  if ((doctor.rewardPoints || 0) >= threshold) {
    if (!(doctor.isPopular && doctor.popularType === 'earned')) data = { isPopular: true, popularType: 'earned' };
  } else if (doctor.popularType === 'earned') {
    data = { isPopular: false, popularType: null };
  }
  if (!data) return doctor;
  return prisma.doctorProfile.update({ where: { id: doctor.id }, data });
}

/**
 * Add points to a doctor and recompute their popular status.
 *
 * Pass `ledger` ({ note, kind }) to also record a line item in the doctor's
 * pointsAdjustments history (referral bonuses). Omit for visit/review points.
 */
async function addDoctorPoints(doctorId, points, ledger) {
  let doctor;
  if (ledger && points) {
    // Read-append-write the JSON ledger inside a transaction; rewardPoints still
    // moves via an atomic increment in the same update.
    doctor = await prisma.$transaction(async (tx) => {
      const d = await tx.doctorProfile.findUnique({ where: { id: doctorId }, select: { pointsAdjustments: true } });
      if (!d) return null;
      const adj = Array.isArray(d.pointsAdjustments) ? d.pointsAdjustments : [];
      adj.push({ points, note: ledger.note || '', kind: ledger.kind || 'admin', createdAt: new Date() });
      return tx.doctorProfile.update({
        where: { id: doctorId },
        data: { rewardPoints: { increment: points }, pointsAdjustments: adj },
      });
    });
  } else {
    doctor = await prisma.doctorProfile.update({
      where: { id: doctorId },
      data: { rewardPoints: { increment: points } },
    }).catch(() => null);
  }
  if (!doctor) return null;

  try {
    return await recomputePopular(doctor);
  } catch (e) {
    console.error('recomputePopular failed (points already saved):', e.message);
    return doctor;
  }
}

module.exports = { recomputePopular, addDoctorPoints, getThreshold };
