require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const Treatment = require('../models/Treatment');
const Gallery = require('../models/Gallery');
const Review = require('../models/Review');

const seedDoctorsOnly = async () => {
  try {
    await connectDB();
    console.log('\n🩺 Adding mock doctors back to database...\n');

    // 1. Clear only doctor-related data to preserve patient accounts
    await User.deleteMany({ role: 'doctor' });
    await DoctorProfile.deleteMany({});
    await Treatment.deleteMany({});
    await Gallery.deleteMany({});
    await Review.deleteMany({});

    // 2. Create Doctor Users (without hashing, because the pre-save hook handles it now!)
    const users = await User.create([
      { email: 'dr.ali.raza@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.sana.malik@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.usman.tariq@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.ayesha.noor@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true }
    ]);

    // 3. Create Doctor Profiles
    const doctorProfiles = await DoctorProfile.create([
      {
        userId: users[0]._id,
        fullName: 'Dr. Ali Raza',
        specialization: 'Implant Specialist',
        qualification: 'BDS, MDS (Implantology)',
        experience: 8,
        clinicName: 'Elite Dental Clinic',
        clinicTier: 'elite',
        facilityScore: 28,
        pmdcVerified: true,
        languages: ['English', 'Urdu'],
        clinicTiming: { days: 'Mon - Sat', startTime: '10:00', endTime: '20:00' },
        onlineStatus: 'online',
        about: 'Dr. Ali Raza is a highly experienced Implant Specialist.',
        address: 'F-8 Markaz, Islamabad',
        location: { type: 'Point', coordinates: [73.0400, 33.7100] }
      },
      {
        userId: users[1]._id,
        fullName: 'Dr. Sana Malik',
        specialization: 'Cosmetic Dentist',
        qualification: 'BDS, FCPS (Prosthodontics)',
        experience: 6,
        clinicName: 'Smile Care Clinic',
        clinicTier: 'modern',
        facilityScore: 20,
        pmdcVerified: true,
        languages: ['English', 'Urdu'],
        clinicTiming: { days: 'Mon - Fri', startTime: '09:00', endTime: '18:00' },
        onlineStatus: 'online',
        about: 'Dr. Sana Malik is a skilled Cosmetic Dentist.',
        address: 'G-9 Markaz, Islamabad',
        location: { type: 'Point', coordinates: [73.0300, 33.6900] }
      }
    ]);

    // 4. Add Treatments for Dr. Ali Raza
    await Treatment.create([
      { doctorId: doctorProfiles[0]._id, name: 'Dental Implants', priceMin: 80000, priceMax: 150000 },
      { doctorId: doctorProfiles[0]._id, name: 'Teeth Cleaning', priceMin: 5000, priceMax: 10000 }
    ]);

    console.log('✅ Successfully added mock Doctors!');
    console.log(`Use this doctor ID for booking appointments: ${doctorProfiles[0]._id}\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding doctors:', error);
    process.exit(1);
  }
};

seedDoctorsOnly();
