/**
 * Create (or reset) the first super-admin account.
 *
 *   node scripts/create-admin.js
 *
 * Login: admin@mydentist.com / Admin@1234   (change after first login)
 * Safe to re-run: resets the password if the account already exists.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const AdminProfile = require('../models/AdminProfile');

const EMAIL = 'admin@mydentist.com';
const PASSWORD = 'Admin@1234';

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  let user = await User.findOne({ email: EMAIL }).select('+password');
  if (user) {
    user.role = 'admin';
    user.password = PASSWORD; // pre-save hook re-hashes
    await user.save();
    console.log(`↻ reset existing admin: ${EMAIL}`);
  } else {
    user = await User.create({ email: EMAIL, password: PASSWORD, role: 'admin', isAgreed: true });
    console.log(`✓ created admin user: ${EMAIL}`);
  }

  const profile = await AdminProfile.findOne({ userId: user._id });
  if (!profile) {
    await AdminProfile.create({
      userId: user._id,
      fullName: 'Super Admin',
      adminRole: 'super_admin',
      status: 'active',
    });
    console.log('✓ created admin profile (super_admin)');
  }

  console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);
  await mongoose.disconnect();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
