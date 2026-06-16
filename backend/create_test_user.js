const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const PatientProfile = require('./models/PatientProfile');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    // Delete existing test user if any
    await User.deleteOne({ email: 'patient@test.com' });

    // Create user (password will be auto-hashed by the User model pre-save hook)
    const user = await User.create({
      email: 'patient@test.com',
      password: 'test1234',
      role: 'patient'
    });

    // Create patient profile
    await PatientProfile.findOneAndDelete({ userId: user._id });
    await PatientProfile.create({
      userId: user._id,
      fullName: 'Test Patient',
      mobileNumber: '03165390189'
    });

    console.log('✅ Account created successfully!');
    console.log('================================');
    console.log('  Email:    patient@test.com');
    console.log('  Password: test1234');
    console.log('================================');
    process.exit(0);
  })
  .catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
