const DoctorProfile = require('../models/DoctorProfile');
const AppSettings = require('../models/AppSettings');

const DEFAULT_THRESHOLD = 20000;

async function getThreshold() {
  const s = await AppSettings.findOne({ key: 'global' });
  return s?.popularPointsThreshold ?? DEFAULT_THRESHOLD;
}

/**
 * Recompute a doctor's popular status from their reward points.
 *
 * Rules:
 *  - Paid (blue) status is admin-granted and is NEVER auto-removed here.
 *  - Reaching the points threshold grants earned (green) status.
 *  - Dropping below the threshold removes ONLY earned status (not paid).
 *
 * @param {Document} doctor a DoctorProfile mongoose doc (will be saved)
 */
async function recomputePopular(doctor) {
  if (doctor.popularType === 'paid') return doctor; // paid stays paid

  const threshold = await getThreshold();
  if ((doctor.rewardPoints || 0) >= threshold) {
    doctor.isPopular = true;
    doctor.popularType = 'earned';
  } else if (doctor.popularType === 'earned') {
    doctor.isPopular = false;
    doctor.popularType = null;
  }
  await doctor.save();
  return doctor;
}

/**
 * Add points to a doctor and recompute their popular status.
 */
async function addDoctorPoints(doctorId, points) {
  // Atomic $inc so the points ALWAYS persist — a load-modify-.save() would throw
  // (and silently lose the points) if the DoctorProfile has any unrelated validation
  // gap. Popular status is then recomputed best-effort on the already-saved doc.
  const doctor = await DoctorProfile.findByIdAndUpdate(
    doctorId,
    { $inc: { rewardPoints: points } },
    { new: true }
  );
  if (!doctor) return null;
  try {
    return await recomputePopular(doctor);
  } catch (e) {
    console.error('recomputePopular failed (points already saved):', e.message);
    return doctor;
  }
}

module.exports = { recomputePopular, addDoctorPoints, getThreshold };
