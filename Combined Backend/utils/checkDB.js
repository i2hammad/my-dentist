require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');

const checkDB = async () => {
  try {
    await connectDB();
    const users = await User.find({ role: 'patient' });
    const profiles = await PatientProfile.find();
    
    console.log(`--- PATIENTS IN DB (${users.length}) ---`);
    users.forEach(u => console.log(`ID: ${u._id} | Email: ${u.email}`));
    
    console.log(`\n--- PROFILES IN DB (${profiles.length}) ---`);
    profiles.forEach(p => console.log(`UserId: ${p.userId} | Name: ${p.fullName}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
checkDB();
