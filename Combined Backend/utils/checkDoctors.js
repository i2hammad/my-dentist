require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const DoctorProfile = require('../models/DoctorProfile');

const checkDoctors = async () => {
  try {
    await connectDB();
    const doctors = await DoctorProfile.find();
    
    console.log(`\n--- DOCTORS IN DB (${doctors.length}) ---`);
    doctors.forEach(d => console.log(`ID: ${d._id} | Name: ${d.fullName}`));

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
checkDoctors();
