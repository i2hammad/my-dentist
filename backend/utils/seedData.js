require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');

// Import all models
const User = require('../models/User');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Treatment = require('../models/Treatment');
const Appointment = require('../models/Appointment');
const Bill = require('../models/Bill');
const Review = require('../models/Review');
const Reward = require('../models/Reward');
const PaymentMethod = require('../models/PaymentMethod');
const Gallery = require('../models/Gallery');
const Notification = require('../models/Notification');
const Favorite = require('../models/Favorite');

const seedData = async () => {
  try {
    await connectDB();
    console.log('\n🌱 Starting seed process...\n');

    // ─── Clear existing data ────────────────────────────────
    await Promise.all([
      User.deleteMany({}),
      PatientProfile.deleteMany({}),
      DoctorProfile.deleteMany({}),
      Treatment.deleteMany({}),
      Appointment.deleteMany({}),
      Bill.deleteMany({}),
      Review.deleteMany({}),
      Reward.deleteMany({}),
      PaymentMethod.deleteMany({}),
      Gallery.deleteMany({}),
      Notification.deleteMany({}),
      Favorite.deleteMany({})
    ]);
    console.log('✅ Cleared all existing data');

    // ─── Create Users ───────────────────────────────────────
    const users = await User.create([
      // Doctors
      { email: 'dr.ali.raza@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.sana.malik@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.usman.tariq@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      { email: 'dr.ayesha.noor@mydentist.com', password: 'password123', role: 'doctor', isAgreed: true },
      // Patients
      { email: 'patient@mydentist.com', password: 'password123', role: 'patient', isAgreed: true },
      { email: 'ahmad.khan@gmail.com', password: 'password123', role: 'patient', isAgreed: true },
      { email: 'sana.fatima@gmail.com', password: 'password123', role: 'patient', isAgreed: true },
      // Vendor
      { email: 'vendor@mydentist.com', password: 'password123', role: 'vendor', isAgreed: true }
    ]);

    console.log(`✅ Created ${users.length} users`);

    // ─── Create Doctor Profiles ─────────────────────────────
    // Islamabad coordinates: 33.6844, 73.0479
    const doctorProfiles = await DoctorProfile.create([
      {
        userId: users[0]._id,
        fullName: 'Dr. Ali Raza',
        photo: '',
        specialization: 'Implant Specialist',
        qualification: 'BDS, MDS (Implantology)',
        experience: 8,
        clinicName: 'Elite Dental Clinic',
        clinicTier: 'elite',
        facilityScore: 28,
        pmdcVerified: true,
        languages: ['English', 'Urdu'],
        clinicTiming: { days: 'Mon - Sat', startTime: '10:00 AM', endTime: '08:00 PM' },
        onlineStatus: 'online',
        about: 'Dr. Ali Raza is a highly experienced Implant Specialist with over 8 years of expertise in advanced dental implant procedures, cosmetic dentistry and smile makeovers. He is dedicated to providing personalized and painless dental care with the latest technology.',
        address: 'F-8 Markaz, Islamabad',
        location: { type: 'Point', coordinates: [73.0400, 33.7100] },
        services: [
          'Autoclave Sterilization', 'UV Sterilization', 'Disposable Instruments',
          'Separate Sterilization Room', 'Infection Control System', 'Surgical Gloves',
          'Surgical Masks', 'Face Shields', 'Safety Glasses',
          'Hand Sanitizer Availability', 'Digital X-Ray', 'RVG System',
          'Laser Dentistry', 'Implant Facility', 'Orthodontic Setup',
          'Air Conditioned', 'Waiting Area', 'Drinking Water',
          'Free Wi-Fi', 'Backup Generator', 'Parking Available',
          'Wheelchair Accessible', 'Fire Safety Equipment', 'Ambulance Service',
          'First Aid Kit', 'Online Consultation', '24/7 Emergency Support',
          'Online Appointment Booking', 'SMS / WhatsApp Reminder', 'Digital Prescription',
          'EasyPaisa / JazzCash'
        ]
      },
      {
        userId: users[1]._id,
        fullName: 'Dr. Sana Malik',
        photo: '',
        specialization: 'Cosmetic Dentist',
        qualification: 'BDS, FCPS (Prosthodontics)',
        experience: 6,
        clinicName: 'Smile Care Clinic',
        clinicTier: 'modern',
        facilityScore: 20,
        pmdcVerified: true,
        languages: ['English', 'Urdu'],
        clinicTiming: { days: 'Mon - Fri', startTime: '09:00 AM', endTime: '06:00 PM' },
        onlineStatus: 'online',
        about: 'Dr. Sana Malik is a skilled Cosmetic Dentist specializing in smile design, veneers, teeth whitening, and full mouth rehabilitation. She brings 6+ years of experience in creating beautiful smiles.',
        address: 'G-9 Markaz, Islamabad',
        location: { type: 'Point', coordinates: [73.0300, 33.6900] },
        services: [
          'Autoclave Sterilization', 'Infection Control System', 'Digital X-Ray',
          'Air Conditioned', 'Waiting Area', 'Free Wi-Fi',
          'Online Consultation', 'Online Appointment Booking', 'Digital Prescription',
          'Parking Available', 'SMS / WhatsApp Reminder'
        ]
      },
      {
        userId: users[2]._id,
        fullName: 'Dr. Usman Tariq',
        photo: '',
        specialization: 'Orthodontist',
        qualification: 'BDS, MDS (Orthodontics)',
        experience: 7,
        clinicName: 'Dental Experts Clinic',
        clinicTier: 'modern',
        facilityScore: 18,
        pmdcVerified: true,
        languages: ['English', 'Urdu', 'Punjabi'],
        clinicTiming: { days: 'Mon - Sat', startTime: '11:00 AM', endTime: '09:00 PM' },
        onlineStatus: 'busy',
        about: 'Dr. Usman Tariq is a renowned Orthodontist with expertise in braces, clear aligners, and jaw alignment. With 7+ years of experience, he has transformed thousands of smiles.',
        address: 'Blue Area, Islamabad',
        location: { type: 'Point', coordinates: [73.0500, 33.7050] },
        services: [
          'Autoclave Sterilization', 'Digital X-Ray', 'Orthodontic Setup',
          'Air Conditioned', 'Waiting Area', 'Free Wi-Fi',
          'Parking Available', 'Online Appointment Booking'
        ]
      },
      {
        userId: users[3]._id,
        fullName: 'Dr. Ayesha Noor',
        photo: '',
        specialization: 'Pediatric Dentist',
        qualification: 'BDS, MCPS (Pediatric Dentistry)',
        experience: 5,
        clinicName: 'Kids Dental Care',
        clinicTier: 'standard',
        facilityScore: 8,
        pmdcVerified: true,
        languages: ['English', 'Urdu'],
        clinicTiming: { days: 'Mon - Sat', startTime: '10:00 AM', endTime: '07:00 PM' },
        onlineStatus: 'online',
        about: 'Dr. Ayesha Noor is a caring Pediatric Dentist who specializes in children\'s dental health. With 5+ years of experience, she makes dental visits fun and stress-free for kids.',
        address: 'I-8 Markaz, Islamabad',
        location: { type: 'Point', coordinates: [73.0700, 33.6700] },
        services: [
          'Autoclave Sterilization', 'Infection Control System',
          'Air Conditioned', 'Waiting Area', 'Drinking Water',
          'Parking Available', 'Online Appointment Booking'
        ]
      }
    ]);

    console.log(`✅ Created ${doctorProfiles.length} doctor profiles`);

    // ─── Create Patient Profiles ────────────────────────────
    const patientProfiles = await PatientProfile.create([
      {
        userId: users[4]._id,
        fullName: 'Test Patient',
        mobileNumber: '03001234567',
        dateOfBirth: new Date('1995-06-15'),
        gender: 'male',
        city: 'Islamabad',
        location: { type: 'Point', coordinates: [73.0479, 33.6844] },
        profileImage: ''
      },
      {
        userId: users[5]._id,
        fullName: 'Ahmad Khan',
        mobileNumber: '03009876543',
        dateOfBirth: new Date('1990-03-20'),
        gender: 'male',
        city: 'Islamabad',
        location: { type: 'Point', coordinates: [73.0500, 33.6900] },
        profileImage: ''
      },
      {
        userId: users[6]._id,
        fullName: 'Sana Fatima',
        mobileNumber: '03117654321',
        dateOfBirth: new Date('1988-11-10'),
        gender: 'female',
        city: 'Islamabad',
        location: { type: 'Point', coordinates: [73.0450, 33.7000] },
        profileImage: ''
      }
    ]);

    console.log(`✅ Created ${patientProfiles.length} patient profiles`);

    // ─── Create Treatments (for Dr. Ali Raza) ───────────────
    const treatments = await Treatment.create([
      { doctorId: doctorProfiles[0]._id, name: 'Dental Implants', priceMin: 80000, priceMax: 150000 },
      { doctorId: doctorProfiles[0]._id, name: 'Root Canal Treatment', priceMin: 15000, priceMax: 25000 },
      { doctorId: doctorProfiles[0]._id, name: 'Braces / Orthodontics', priceMin: 60000, priceMax: 120000 },
      { doctorId: doctorProfiles[0]._id, name: 'Teeth Whitening', priceMin: 10000, priceMax: 20000 },
      { doctorId: doctorProfiles[0]._id, name: 'Veneers', priceMin: 25000, priceMax: 45000 },
      { doctorId: doctorProfiles[0]._id, name: 'Wisdom Tooth Surgery', priceMin: 12000, priceMax: 18000 },
      { doctorId: doctorProfiles[0]._id, name: 'Dental Fillings', priceMin: 5000, priceMax: 12000 },
      { doctorId: doctorProfiles[0]._id, name: 'Gum Treatment', priceMin: 6000, priceMax: 15000 },
      { doctorId: doctorProfiles[0]._id, name: 'Tooth Extraction', priceMin: 4000, priceMax: 10000 },
      { doctorId: doctorProfiles[0]._id, name: 'Crowns & Bridges', priceMin: 20000, priceMax: 40000 },
      { doctorId: doctorProfiles[0]._id, name: 'Pediatric Dentistry', priceMin: 5000, priceMax: 15000 },
      { doctorId: doctorProfiles[0]._id, name: 'Full Mouth Rehabilitation', priceMin: 150000, priceMax: 300000 },
      // Treatments for Dr. Sana Malik
      { doctorId: doctorProfiles[1]._id, name: 'Teeth Whitening', priceMin: 8000, priceMax: 18000 },
      { doctorId: doctorProfiles[1]._id, name: 'Veneers', priceMin: 30000, priceMax: 50000 },
      { doctorId: doctorProfiles[1]._id, name: 'Dental Fillings', priceMin: 4000, priceMax: 10000 },
      { doctorId: doctorProfiles[1]._id, name: 'Smile Design', priceMin: 50000, priceMax: 100000 },
      // Treatments for Dr. Usman Tariq
      { doctorId: doctorProfiles[2]._id, name: 'Braces / Orthodontics', priceMin: 50000, priceMax: 110000 },
      { doctorId: doctorProfiles[2]._id, name: 'Clear Aligners', priceMin: 150000, priceMax: 300000 },
      { doctorId: doctorProfiles[2]._id, name: 'Retainers', priceMin: 10000, priceMax: 20000 },
      // Treatments for Dr. Ayesha Noor
      { doctorId: doctorProfiles[3]._id, name: 'Pediatric Dentistry', priceMin: 3000, priceMax: 12000 },
      { doctorId: doctorProfiles[3]._id, name: 'Dental Fillings', priceMin: 3000, priceMax: 8000 },
      { doctorId: doctorProfiles[3]._id, name: 'Tooth Extraction', priceMin: 3000, priceMax: 8000 },
      { doctorId: doctorProfiles[3]._id, name: 'Fluoride Treatment', priceMin: 2000, priceMax: 5000 }
    ]);

    console.log(`✅ Created ${treatments.length} treatments`);

    // ─── Create Appointments ────────────────────────────────
    const appointments = await Appointment.create([
      // Upcoming
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        treatmentType: 'Consultation',
        description: 'General Checkup',
        date: new Date('2026-06-20'),
        time: '10:30 AM',
        duration: 30,
        status: 'confirmed'
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        treatmentType: 'Teeth Cleaning',
        description: 'Dental Cleaning & Polishing',
        date: new Date('2026-06-27'),
        time: '11:00 AM',
        duration: 45,
        status: 'confirmed'
      },
      // Past - completed
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        treatmentType: 'Root Canal Treatment',
        description: 'Upper Right Molar',
        date: new Date('2026-04-15'),
        time: '02:00 PM',
        duration: 60,
        status: 'completed',
        visitSummary: 'Root canal procedure completed successfully on upper right molar. Patient tolerated the procedure well. Follow-up scheduled in 2 weeks.'
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        treatmentType: 'Dental X-Ray',
        description: 'Full Mouth X-Ray',
        date: new Date('2026-04-02'),
        time: '09:30 AM',
        duration: 20,
        status: 'completed',
        visitSummary: 'Full mouth X-ray taken. No major issues detected. Minor cavity in lower left premolar recommended for filling.'
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        treatmentType: 'Dental Implant (Consultation)',
        description: 'Initial consultation for dental implant',
        date: new Date('2026-03-15'),
        time: '03:00 PM',
        duration: 45,
        status: 'completed',
        visitSummary: 'Consultation for dental implant on upper left incisor. Treatment plan discussed. Patient agreed to proceed.'
      }
    ]);

    console.log(`✅ Created ${appointments.length} appointments`);

    // ─── Create Bills ───────────────────────────────────────
    const bills = await Bill.create([
      {
        appointmentId: appointments[0]._id,
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260620-001',
        treatmentName: 'Teeth Cleaning',
        amount: 1500,
        discountFromRewards: 0,
        status: 'unpaid',
        dueDate: new Date('2026-06-28')
      },
      {
        appointmentId: appointments[2]._id,
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260520-001',
        treatmentName: 'Consultation',
        amount: 1500,
        discountFromRewards: 0,
        status: 'paid',
        dueDate: new Date('2026-05-20'),
        paidAt: new Date('2026-05-20')
      },
      {
        appointmentId: appointments[3]._id,
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260510-002',
        treatmentName: 'Teeth Cleaning',
        amount: 2000,
        discountFromRewards: 150,
        status: 'paid',
        dueDate: new Date('2026-05-10'),
        paidAt: new Date('2026-05-10')
      },
      {
        appointmentId: appointments[4]._id,
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260425-003',
        treatmentName: 'Dental Implant (Consultation)',
        amount: 1000,
        discountFromRewards: 0,
        status: 'paid',
        dueDate: new Date('2026-04-25'),
        paidAt: new Date('2026-04-25')
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260405-004',
        treatmentName: 'Braces Adjustment',
        amount: 1500,
        discountFromRewards: 0,
        status: 'paid',
        dueDate: new Date('2026-04-05'),
        paidAt: new Date('2026-04-05')
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        invoiceNumber: 'INV-260605-005',
        treatmentName: 'Root Canal Treatment',
        amount: 1500,
        discountFromRewards: 0,
        status: 'unpaid',
        dueDate: new Date('2026-06-05')
      }
    ]);

    console.log(`✅ Created ${bills.length} bills`);

    // ─── Create Reviews ─────────────────────────────────────
    const reviews = await Review.create([
      // Reviews for Dr. Ali Raza
      {
        patientId: patientProfiles[1]._id,
        doctorId: doctorProfiles[0]._id,
        rating: 5,
        comment: 'Dr. Ali Raza is an excellent doctor! He explained everything clearly and made me feel comfortable throughout the treatment.',
        isVerifiedPatient: true,
        helpfulCount: 12
      },
      {
        patientId: patientProfiles[2]._id,
        doctorId: doctorProfiles[0]._id,
        rating: 5,
        comment: 'I had a great experience with my dental implant. The clinic is very clean and the staff is so cooperative. Thank you Dr. Ali Raza!',
        isVerifiedPatient: true,
        helpfulCount: 8
      },
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[0]._id,
        rating: 5,
        comment: 'Best implant specialist in Islamabad. Very professional and caring.',
        isVerifiedPatient: true,
        helpfulCount: 5
      },
      // Reviews for Dr. Sana Malik
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[1]._id,
        rating: 5,
        comment: 'Amazing cosmetic dentist! My smile looks beautiful after the veneers treatment.',
        isVerifiedPatient: true,
        helpfulCount: 10
      },
      {
        patientId: patientProfiles[1]._id,
        doctorId: doctorProfiles[1]._id,
        rating: 4,
        comment: 'Great experience. Professional and friendly staff.',
        isVerifiedPatient: true,
        helpfulCount: 3
      },
      // Reviews for Dr. Usman Tariq
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[2]._id,
        rating: 5,
        comment: 'Dr. Usman is excellent with braces. My teeth look perfect now!',
        isVerifiedPatient: true,
        helpfulCount: 7
      },
      // Reviews for Dr. Ayesha Noor
      {
        patientId: patientProfiles[0]._id,
        doctorId: doctorProfiles[3]._id,
        rating: 5,
        comment: 'My kids love Dr. Ayesha! She makes dental visits fun and stress-free.',
        isVerifiedPatient: true,
        helpfulCount: 15
      }
    ]);

    console.log(`✅ Created ${reviews.length} reviews`);

    // ─── Create Rewards ─────────────────────────────────────
    const rewards = await Reward.create([
      {
        patientId: patientProfiles[0]._id,
        type: 'visit',
        points: 490,
        description: 'Points earned from payments (2% of PKR 24,500)'
      },
      {
        patientId: patientProfiles[0]._id,
        type: 'referral',
        points: 300,
        description: '3 friend referrals completed'
      },
      {
        patientId: patientProfiles[0]._id,
        type: 'review',
        points: 150,
        description: 'Points earned from 3 verified reviews'
      },
      {
        patientId: patientProfiles[0]._id,
        type: 'visit',
        points: 310,
        description: 'Additional visit payments reward'
      }
    ]);

    console.log(`✅ Created ${rewards.length} reward entries (Total: 1,250 points)`);

    // ─── Create Payment Methods ─────────────────────────────
    const paymentMethods = await PaymentMethod.create([
      {
        userId: users[4]._id,
        type: 'visa',
        lastFourDigits: '4242',
        expiryDate: '08/27',
        isDefault: true
      },
      {
        userId: users[4]._id,
        type: 'mastercard',
        lastFourDigits: '8888',
        expiryDate: '11/26',
        isDefault: false
      },
      {
        userId: users[4]._id,
        type: 'easypaisa',
        accountNumber: '03xx-xxxxxxx-123',
        isDefault: false
      },
      {
        userId: users[4]._id,
        type: 'jazzcash',
        accountNumber: '03xx-xxxxxxx-456',
        isDefault: false
      }
    ]);

    console.log(`✅ Created ${paymentMethods.length} payment methods`);

    // ─── Create Gallery Items ───────────────────────────────
    const galleryItems = await Gallery.create([
      // Dr. Ali Raza - Clinic Photos
      { doctorId: doctorProfiles[0]._id, category: 'clinic_photo', imageUrl: '/uploads/gallery/clinic1.jpg', title: 'Reception Area' },
      { doctorId: doctorProfiles[0]._id, category: 'clinic_photo', imageUrl: '/uploads/gallery/clinic2.jpg', title: 'Waiting Lounge' },
      { doctorId: doctorProfiles[0]._id, category: 'clinic_photo', imageUrl: '/uploads/gallery/clinic3.jpg', title: 'Treatment Room' },
      { doctorId: doctorProfiles[0]._id, category: 'clinic_photo', imageUrl: '/uploads/gallery/clinic4.jpg', title: 'Equipment Room' },
      // Dr. Ali Raza - Before & After
      { doctorId: doctorProfiles[0]._id, category: 'before_after', imageUrl: 'placeholder.jpg', title: 'Teeth Whitening', beforeImage: '/uploads/gallery/whitening_before.jpg', afterImage: '/uploads/gallery/whitening_after.jpg' },
      { doctorId: doctorProfiles[0]._id, category: 'before_after', imageUrl: 'placeholder.jpg', title: 'Dental Implants', beforeImage: '/uploads/gallery/implant_before.jpg', afterImage: '/uploads/gallery/implant_after.jpg' },
      { doctorId: doctorProfiles[0]._id, category: 'before_after', imageUrl: 'placeholder.jpg', title: 'Braces / Orthodontics', beforeImage: '/uploads/gallery/braces_before.jpg', afterImage: '/uploads/gallery/braces_after.jpg' },
      // Dr. Ali Raza - Certificates
      { doctorId: doctorProfiles[0]._id, category: 'certificate', imageUrl: '/uploads/gallery/cert1.jpg', title: 'Implantology Course', description: 'Certificate of Completion' },
      { doctorId: doctorProfiles[0]._id, category: 'certificate', imageUrl: '/uploads/gallery/cert2.jpg', title: 'Appreciation Award', description: 'Certificate of Appreciation' },
      { doctorId: doctorProfiles[0]._id, category: 'certificate', imageUrl: '/uploads/gallery/cert3.jpg', title: 'Implant Workshop', description: 'Certificate of Participation' },
      { doctorId: doctorProfiles[0]._id, category: 'certificate', imageUrl: '/uploads/gallery/cert4.jpg', title: 'Dental Excellence', description: 'Certificate of Achievement' }
    ]);

    console.log(`✅ Created ${galleryItems.length} gallery items`);

    // ─── Create Notifications ───────────────────────────────
    const notifications = await Notification.create([
      {
        userId: users[4]._id,
        title: 'Appointment Confirmed',
        message: 'Your consultation appointment with Dr. Ali Raza on June 20, 2026 at 10:30 AM has been confirmed.',
        type: 'appointment',
        isRead: false
      },
      {
        userId: users[4]._id,
        title: 'Payment Due',
        message: 'You have an outstanding payment of PKR 1,500 for Teeth Cleaning. Due date: June 28, 2026.',
        type: 'bill',
        isRead: false
      },
      {
        userId: users[4]._id,
        title: 'Reward Points Earned',
        message: 'You earned 30 reward points from your recent payment! Total balance: 1,250 points.',
        type: 'reward',
        isRead: true
      }
    ]);

    console.log(`✅ Created ${notifications.length} notifications`);

    // ─── Create Favorites ───────────────────────────────────
    const favorites = await Favorite.create([
      { patientId: users[4]._id, doctorId: doctorProfiles[0]._id },
      { patientId: users[4]._id, doctorId: doctorProfiles[1]._id }
    ]);

    console.log(`✅ Created ${favorites.length} favorites`);

    // ─── Summary ────────────────────────────────────────────
    console.log('\n🎉 ═══════════════════════════════════════════');
    console.log('   Seed data loaded successfully!');
    console.log('═══════════════════════════════════════════════');
    console.log('\n📋 Test Accounts:');
    console.log('─────────────────────────────────────────────');
    console.log('  🩺 Doctor:  dr.ali.raza@mydentist.com / password123');
    console.log('  🩺 Doctor:  dr.sana.malik@mydentist.com / password123');
    console.log('  🩺 Doctor:  dr.usman.tariq@mydentist.com / password123');
    console.log('  🩺 Doctor:  dr.ayesha.noor@mydentist.com / password123');
    console.log('  💚 Patient: patient@mydentist.com / password123');
    console.log('  💚 Patient: ahmad.khan@gmail.com / password123');
    console.log('  💚 Patient: sana.fatima@gmail.com / password123');
    console.log('  🛍️  Vendor:  vendor@mydentist.com / password123');
    console.log('─────────────────────────────────────────────\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed Error:', error);
    process.exit(1);
  }
};

seedData();
