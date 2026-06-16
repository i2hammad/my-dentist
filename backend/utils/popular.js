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
  const doctor = await DoctorProfile.findById(doctorId);
  if (!doctor) return null;
  doctor.rewardPoints = (doctor.rewardPoints || 0) + points;
  return recomputePopular(doctor);
}

module.exports = { recomputePopular, addDoctorPoints, getThreshold };
