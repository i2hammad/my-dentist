const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const DoctorProfile = require('./models/DoctorProfile');

const seedDoctors = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Create users for doctors
    const doctorsData = [
      { email: 'dr.smith@mydentist.com', name: 'Dr. Sarah Smith', specialization: 'Dentist' },
      { email: 'dr.jones@mydentist.com', name: 'Dr. Mike Jones', specialization: 'Cardiologist' },
      { email: 'dr.lee@mydentist.com', name: 'Dr. Anna Lee', specialization: 'Neurologist' }
    ];

    for (const data of doctorsData) {
      let user = await User.findOne({ email: data.email });
      if (!user) {
        user = await User.create({
          email: data.email,
          password: 'password123',
          role: 'doctor'
        });
      }

      let profile = await DoctorProfile.findOne({ userId: user._id });
      if (!profile) {
        await DoctorProfile.create({
          userId: user._id,
          fullName: data.name,
          specialization: data.specialization,
          clinicName: 'MyDentist Clinic',
          experience: 10,
          consultationFee: 50,
          about: `I am ${data.name}, a highly experienced ${data.specialization}.`
        });
        console.log(`Created profile for ${data.name}`);
      } else {
        console.log(`Profile already exists for ${data.name}`);
      }
    }

    console.log('Mock doctors seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDoctors();
