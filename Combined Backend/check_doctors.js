const mongoose = require('mongoose');
require('dotenv').config();
const DoctorProfile = require('./models/DoctorProfile');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const doctors = await DoctorProfile.find().populate('userId');
    console.log(JSON.stringify(doctors, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
