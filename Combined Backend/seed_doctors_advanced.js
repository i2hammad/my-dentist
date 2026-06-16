const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const DoctorProfile = require('./models/DoctorProfile');
const PatientProfile = require('./models/PatientProfile');
const Treatment = require('./models/Treatment');
const Review = require('./models/Review');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB. Starting database cleaning...');

    // Clear existing doctors and reviews
    const doctors = await User.find({ role: 'doctor' });
    const doctorIds = doctors.map(d => d._id);
    
    await DoctorProfile.deleteMany({});
    await User.deleteMany({ role: 'doctor' });
    await Treatment.deleteMany({});
    await Review.deleteMany({});

    console.log('Database cleaned. Creating dentist accounts...');

    // Hash password for doctors
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('test1234', salt);

    // Seed Doctor Users
    const doctorUsers = [
      { email: 'dr.ali@mydentist.com', password: passwordHash, role: 'doctor' },
      { email: 'dr.sana@mydentist.com', password: passwordHash, role: 'doctor' },
      { email: 'dr.usman@mydentist.com', password: passwordHash, role: 'doctor' },
      { email: 'dr.ayesha@mydentist.com', password: passwordHash, role: 'doctor' }
    ];

    const createdUsers = await User.create(doctorUsers);
    console.log(`Created ${createdUsers.length} doctor user accounts.`);

    // Seed Doctor Profiles
    const profiles = [
      {
        userId: createdUsers[0]._id,
        fullName: 'Dr. Ali Raza',
        specialization: 'Implant Specialist',
        clinicName: 'Elite Dental Clinic',
        clinicTier: 'elite',
        facilityScore: 28,
        experience: 8,
        pmdcVerified: true,
        onlineStatus: 'online',
        about: 'BDS, MDS (Implantology). 8+ Years experience. Specialized in Dental Implants and Full Mouth Rehabilitation. PMDC Verified.',
        address: 'Islamabad, Pakistan',
        services: ['Dental Implants', 'Full Mouth Rehabilitation', 'Digital X-Ray', 'Autoclave Sterilization', 'EasyPaisa/JazzCash'],
        languages: ['English', 'Urdu']
      },
      {
        userId: createdUsers[1]._id,
        fullName: 'Dr. Sana Malik',
        specialization: 'Cosmetic Dentist',
        clinicName: 'Smile Care Clinic',
        clinicTier: 'modern',
        facilityScore: 22,
        experience: 6,
        pmdcVerified: true,
        onlineStatus: 'online',
        about: 'BDS. 6+ Years experience. Specialized in teeth whitening, veneers, and aesthetic restorations.',
        address: 'Smile Care Clinic, Islamabad',
        services: ['Teeth Whitening', 'Veneers', 'Autoclave Sterilization', 'Online Consultation'],
        languages: ['English', 'Urdu']
      },
      {
        userId: createdUsers[2]._id,
        fullName: 'Dr. Usman Tariq',
        specialization: 'Orthodontist',
        clinicName: 'Dental Experts Clinic',
        clinicTier: 'modern',
        facilityScore: 24,
        experience: 10,
        pmdcVerified: true,
        onlineStatus: 'busy',
        about: 'BDS, FCPS (Orthodontics). 10+ Years experience. Specialized in orthodontic alignment and braces.',
        address: 'Dental Experts, Islamabad',
        services: ['Braces / Orthodontics', 'Autoclave Sterilization', 'UV Sterilization'],
        languages: ['English', 'Urdu']
      },
      {
        userId: createdUsers[3]._id,
        fullName: 'Dr. Ayesha Noor',
        specialization: 'Pediatric Dentist',
        clinicName: 'Kids Dental Care',
        clinicTier: 'standard',
        facilityScore: 10,
        experience: 5,
        pmdcVerified: true,
        onlineStatus: 'online',
        about: 'BDS. 5+ Years experience. Specialized child dentist providing a friendly, pain-free environment for kids.',
        address: 'Kids Dental Care, Islamabad',
        services: ['Pediatric Dentistry', 'Fluoride Treatment', 'Free Wi-Fi'],
        languages: ['English', 'Urdu']
      }
    ];

    const createdProfiles = [];
    for (const prof of profiles) {
      const p = await DoctorProfile.create(prof);
      createdProfiles.push(p);
    }
    console.log(`Created ${createdProfiles.length} doctor profiles.`);

    // Seed Treatments
    const treatments = [
      // Ali Raza
      { doctorId: createdProfiles[0]._id, name: 'Dental Implants', priceMin: 80000, priceMax: 150000 },
      { doctorId: createdProfiles[0]._id, name: 'Full Mouth Rehabilitation', priceMin: 150000, priceMax: 300000 },
      { doctorId: createdProfiles[0]._id, name: 'Consultation', priceMin: 1500, priceMax: 2500 },
      // Sana Malik
      { doctorId: createdProfiles[1]._id, name: 'Teeth Whitening', priceMin: 10000, priceMax: 20000 },
      { doctorId: createdProfiles[1]._id, name: 'Veneers', priceMin: 25000, priceMax: 45000 },
      { doctorId: createdProfiles[1]._id, name: 'Root Canal Treatment', priceMin: 15000, priceMax: 25000 },
      // Usman Tariq
      { doctorId: createdProfiles[2]._id, name: 'Braces / Orthodontics', priceMin: 60000, priceMax: 120000 },
      { doctorId: createdProfiles[2]._id, name: 'Dental Fillings', priceMin: 5000, priceMax: 12000 },
      { doctorId: createdProfiles[2]._id, name: 'Crowns & Bridges', priceMin: 20000, priceMax: 40000 },
      // Ayesha Noor
      { doctorId: createdProfiles[3]._id, name: 'Pediatric Dentistry', priceMin: 5000, priceMax: 15000 },
      { doctorId: createdProfiles[3]._id, name: 'Tooth Extraction', priceMin: 4000, priceMax: 10000 }
    ];

    await Treatment.create(treatments);
    console.log('Seeded treatments for dentists.');

    // Fetch or create a test patient profile for reviews
    let testPatientUser = await User.findOne({ email: 'patient@test.com' });
    if (!testPatientUser) {
      testPatientUser = await User.create({
        email: 'patient@test.com',
        password: passwordHash,
        role: 'patient'
      });
    }

    let testPatientProfile = await PatientProfile.findOne({ userId: testPatientUser._id });
    if (!testPatientProfile) {
      testPatientProfile = await PatientProfile.create({
        userId: testPatientUser._id,
        fullName: 'Zahid Khan',
        mobileNumber: '03165390189',
        city: 'Islamabad'
      });
    }

    // Seed Patient Reviews to generate realistic average ratings
    const reviews = [
      // Ali Raza (Rating average ~ 4.9)
      { patientId: testPatientProfile._id, doctorId: createdProfiles[0]._id, rating: 5, comment: 'Excellent implant treatment, very professional team!', isVerifiedPatient: true, helpfulCount: 15 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[0]._id, rating: 5, comment: 'Clean facility and very gentle hand.', isVerifiedPatient: true, helpfulCount: 9 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[0]._id, rating: 5, comment: 'Highly recommended for full mouth rehab.', isVerifiedPatient: true, helpfulCount: 4 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[0]._id, rating: 4, comment: 'Good experience, but appointments are crowded.', isVerifiedPatient: true, helpfulCount: 2 },
      
      // Sana Malik (Rating average ~ 4.8)
      { patientId: testPatientProfile._id, doctorId: createdProfiles[1]._id, rating: 5, comment: 'Amazing teeth whitening results, got 3 shades brighter!', isVerifiedPatient: true, helpfulCount: 8 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[1]._id, rating: 5, comment: 'Beautiful clinic and sweet doctor.', isVerifiedPatient: true, helpfulCount: 5 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[1]._id, rating: 4, comment: 'Veneers feel natural. Slightly expensive.', isVerifiedPatient: true, helpfulCount: 3 },
      
      // Usman Tariq (Rating average ~ 4.7)
      { patientId: testPatientProfile._id, doctorId: createdProfiles[2]._id, rating: 5, comment: 'Best orthodontist in Islamabad, braces progress is fast.', isVerifiedPatient: true, helpfulCount: 12 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[2]._id, rating: 4, comment: 'Good consultation and clinic sterilization.', isVerifiedPatient: true, helpfulCount: 6 },
      
      // Ayesha Noor (Rating average ~ 4.6)
      { patientId: testPatientProfile._id, doctorId: createdProfiles[3]._id, rating: 5, comment: 'Very friendly with kids. My daughter was not scared at all!', isVerifiedPatient: true, helpfulCount: 18 },
      { patientId: testPatientProfile._id, doctorId: createdProfiles[3]._id, rating: 4, comment: 'Good pediatric doctor.', isVerifiedPatient: true, helpfulCount: 3 }
    ];

    await Review.create(reviews);
    console.log('Seeded doctor reviews.');
    console.log('✅ Advanced doctor seeding complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error during seeding:', err.message);
    process.exit(1);
  });
