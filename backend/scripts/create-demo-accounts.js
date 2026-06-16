/**
 * Create (or reset) two demo accounts with KNOWN passwords for testing:
 *   - demo.doctor@mydentist.com  / Demo@1234  (doctor)
 *   - demo.patient@mydentist.com / Demo@1234  (patient)
 *
 *   node scripts/create-demo-accounts.js
 *
 * Safe to re-run: if an account exists, its password is reset to the known
 * value. Touches only these two demo accounts, never real user records.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');

const DEMO = [
  {
    email: 'demo.doctor@mydentist.com',
    password: 'Demo@1234',
    role: 'doctor',
    profile: { fullName: 'Dr. Demo Account', specialization: 'General Dentistry' },
  },
  {
    email: 'demo.patient@mydentist.com',
    password: 'Demo@1234',
    role: 'patient',
    profile: { fullName: 'Demo Patient', mobileNumber: '03001234567' },
  },
];

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  for (const d of DEMO) {
    let user = await User.findOne({ email: d.email }).select('+password');
    if (user) {
      user.password = d.password; // pre-save hook re-hashes
      await user.save();
      console.log(`↻ reset password for ${d.email}`);
    } else {
      user = await User.create({ email: d.email, password: d.password, role: d.role, isAgreed: true });
      const Model = d.role === 'doctor' ? DoctorProfile : PatientProfile;
      const existing = await Model.findOne({ userId: user._id });
      if (!existing) await Model.create({ userId: user._id, ...d.profile });
      console.log(`✓ created ${d.role}: ${d.email}`);
    }
  }
  console.log('\nLogin with password: Demo@1234');
  await mongoose.disconnect();
})().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
