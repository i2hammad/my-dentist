/**
 * Seed richly-detailed dummy doctors and patients (all profile fields filled),
 * plus a few treatments + reviews per doctor so the admin panel looks real.
 *
 *   node scripts/seed-dummy-profiles.js
 *
 * Idempotent-ish: skips any email that already exists.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const DoctorProfile = require('../models/DoctorProfile');
const PatientProfile = require('../models/PatientProfile');
const Treatment = require('../models/Treatment');
const Review = require('../models/Review');

const CLOUD = 'https://res.cloudinary.com/dwhnvgipa/image/upload';
const DOC_F = (i) => `${CLOUD}/mydentist/demo/portraits/doctor-f-${i % 5}.jpg`;
const DOC_M = (i) => `${CLOUD}/mydentist/demo/portraits/doctor-m-${i % 3}.jpg`;
const PAT = (i) => `${CLOUD}/mydentist/demo/portraits/patient-${i % 9}.jpg`;
const DOC_FILE = `${CLOUD}/mydentist/demo/demo-certificate.jpg`;

const CITIES = ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan'];
const SPECS = ['Orthodontist', 'Implant Specialist', 'Cosmetic Dentist', 'Periodontist', 'Endodontist', 'Pediatric Dentist'];
const TIERS = ['elite', 'modern', 'standard'];
const QUALS = ['BDS, FCPS', 'BDS, MDS', 'BDS, MSc Orthodontics', 'BDS, RDS', 'BDS, MPH'];
const SERVICES = ['Teeth Cleaning', 'Root Canal', 'Braces', 'Whitening', 'Implants', 'Crowns', 'Extraction', 'Veneers'];
const ABOUTS = [
  'Dedicated dental surgeon with a passion for pain-free, patient-centric care and the latest clinical techniques.',
  'Experienced specialist focused on cosmetic and restorative dentistry, helping patients regain confident smiles.',
  'Committed to preventive care and patient education, with years of experience across complex cases.',
];

const DOCS = [
  ['Dr. Hira Saleem', 'f'], ['Dr. Bilal Aslam', 'm'], ['Dr. Maria Yousaf', 'f'],
  ['Dr. Kamran Shah', 'm'], ['Dr. Nida Iqbal', 'f'], ['Dr. Faraz Ahmed', 'm'],
  ['Dr. Saira Khan', 'f'], ['Dr. Owais Malik', 'm'], ['Dr. Zoya Hassan', 'f'],
  ['Dr. Tariq Mehmood', 'm'], ['Dr. Komal Raza', 'f'], ['Dr. Hamza Sheikh', 'm'],
];
const PATS = [
  ['Ahmed Raza', 'male'], ['Fatima Noor', 'female'], ['Usman Ali', 'male'], ['Ayesha Siddiqui', 'female'],
  ['Bilal Hussain', 'male'], ['Sana Tariq', 'female'], ['Hassan Javed', 'male'], ['Mahnoor Asif', 'female'],
  ['Daniyal Khan', 'male'], ['Iqra Naveed', 'female'], ['Saad Mirza', 'male'], ['Hina Akram', 'female'],
  ['Zain Abbas', 'male'], ['Rabia Saleem', 'female'], ['Umar Farooq', 'male'],
];

const pick = (arr, i) => arr[i % arr.length];
const slug = (name) => name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  let dCount = 0, pCount = 0;

  // ── Doctors ──
  for (let i = 0; i < DOCS.length; i++) {
    const [name, sex] = DOCS[i];
    const email = `${slug(name)}@mydentist.com`;
    if (await User.findOne({ email })) continue;
    const user = await User.create({ email, password: 'Demo@1234', role: 'doctor', isAgreed: true });
    await DoctorProfile.create({
      userId: user._id,
      fullName: name,
      photo: sex === 'f' ? DOC_F(i) : DOC_M(i),
      specialization: pick(SPECS, i),
      pmdcNumber: `PMDC-${10000 + i * 37}`,
      gender: sex === 'f' ? 'Female' : 'Male',
      clinicContact: `042-3${(5000000 + i * 1234).toString().slice(0, 6)}`,
      city: pick(CITIES, i),
      phone: `03${(100000000 + i * 7654321).toString().slice(0, 9)}`,
      licenseCert: DOC_FILE, idFront: DOC_FILE, idBack: DOC_FILE,
      qualification: pick(QUALS, i),
      consultationFee: 1000 + (i % 5) * 500,
      experience: 3 + (i % 18),
      clinicName: `${name.split(' ')[1]} Dental ${pick(['Care', 'Clinic', 'Studio', 'Center'], i)}`,
      clinicTier: pick(TIERS, i),
      facilityScore: 5 + (i % 25),
      pmdcVerified: i % 3 !== 0,
      languages: i % 2 ? ['English', 'Urdu', 'Punjabi'] : ['English', 'Urdu'],
      clinicTiming: { days: i % 2 ? 'Mon - Sat' : 'Mon - Fri', startTime: '10:00 AM', endTime: i % 2 ? '08:00 PM' : '06:00 PM' },
      onlineStatus: pick(['online', 'busy', 'offline'], i),
      about: pick(ABOUTS, i),
      address: `${100 + i} Main Boulevard, ${pick(CITIES, i)}`,
      services: SERVICES.slice(i % 3, (i % 3) + 4),
    });
    dCount++;
  }

  // Add treatments + a review for the newly created demo doctors
  const newDocs = await DoctorProfile.find({ city: { $exists: true }, photo: /portraits/ }).limit(DOCS.length).lean();
  const anyPatient = await PatientProfile.findOne().lean();
  for (let i = 0; i < newDocs.length; i++) {
    const d = newDocs[i];
    if (await Treatment.countDocuments({ doctorId: d._id })) continue;
    const picks = SERVICES.slice(i % 4, (i % 4) + 3);
    for (const name of picks) {
      const base = 2000 + (i % 6) * 1500;
      await Treatment.create({ doctorId: d._id, name, priceMin: base, priceMax: base + 4000, isActive: true });
    }
    if (anyPatient) {
      await Review.create({
        patientId: anyPatient._id, doctorId: d._id,
        rating: 4 + (i % 2), comment: 'Very professional and gentle. Highly recommended!',
        isVerifiedPatient: true,
      });
    }
  }

  // ── Patients ──
  for (let i = 0; i < PATS.length; i++) {
    const [name, gender] = PATS[i];
    const email = `${slug(name)}@example.com`;
    if (await User.findOne({ email })) continue;
    const user = await User.create({ email, password: 'Demo@1234', role: 'patient', isAgreed: true });
    await PatientProfile.create({
      userId: user._id,
      fullName: name,
      mobileNumber: `03${(200000000 + i * 1234567).toString().slice(0, 9)}`,
      gender,
      city: pick(CITIES, i),
      dateOfBirth: new Date(1985 + (i % 20), i % 12, (i % 27) + 1),
      profileImage: PAT(i),
    });
    pCount++;
  }

  console.log(`Created ${dCount} doctors and ${pCount} patients (+ treatments & reviews).`);
  console.log('All seeded accounts use password: Demo@1234');
  await mongoose.disconnect();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
