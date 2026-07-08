// Prisma seed — resets and populates a usable demo dataset for the Postgres DB.
//   npm run seed   (or: node prisma/seed.js)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../config/prisma');
const { DEFAULT_FACILITY_CATEGORIES, DEFAULT_TIER_THRESHOLDS, DEFAULT_PAYMENTS } = require('../utils/appDefaults');

const hash = async (p) => bcrypt.hash(p, await bcrypt.genSalt(10));

const CLINIC_TIMING = {
  days: 'Mon - Sat', startTime: '10:00', endTime: '20:00',
  morningStart: '10:00', morningEnd: '14:00', eveningStart: '17:00', eveningEnd: '20:00',
  availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], offDays: ['Sun'],
};

async function main() {
  console.log('🌱 Seeding PostgreSQL...');

  // Wipe (child rows first) — dev data only.
  await prisma.$transaction([
    prisma.commissionLog.deleteMany(), prisma.auditLog.deleteMany(), prisma.notification.deleteMany(),
    prisma.chatMessage.deleteMany(), prisma.reward.deleteMany(), prisma.review.deleteMany(),
    prisma.bill.deleteMany(), prisma.appointment.deleteMany(), prisma.treatment.deleteMany(),
    prisma.gallery.deleteMany(), prisma.favorite.deleteMany(), prisma.paymentMethod.deleteMany(),
    prisma.campaign.deleteMany(), prisma.scheduledBroadcast.deleteMany(),
    prisma.doctorProfile.deleteMany(), prisma.patientProfile.deleteMany(),
    prisma.adminProfile.deleteMany(), prisma.appSettings.deleteMany(), prisma.user.deleteMany(),
  ]);

  // Global settings.
  await prisma.appSettings.create({
    data: { key: 'global', facilityCategories: DEFAULT_FACILITY_CATEGORIES, clinicTierThresholds: DEFAULT_TIER_THRESHOLDS, payments: DEFAULT_PAYMENTS, commissionRate: 10 },
  });

  // Super admin.
  const adminUser = await prisma.user.create({ data: { email: 'admin@mydentist.pk', password: await hash('admin123'), role: 'admin', isAgreed: true } });
  await prisma.adminProfile.create({ data: { userId: adminUser.id, fullName: 'Super Admin', adminRole: 'super_admin' } });

  // Doctors.
  const doctorDefs = [
    { email: 'yasir@mydentist.pk', fullName: 'Yasir Khan', specialization: 'Orthodontist', city: 'Islamabad', lat: 33.6844, lng: 73.0479, facilityScore: 34, clinicName: 'Bright Smile Dental' },
    { email: 'zahid@mydentist.pk', fullName: 'Zahid Khan', specialization: 'Prosthodontist', city: 'Rawalpindi', lat: 33.5651, lng: 73.0169, facilityScore: 20, clinicName: 'Rahim Clinic' },
    { email: 'ayesha@mydentist.pk', fullName: 'Ayesha Malik', specialization: 'Periodontist', city: 'Lahore', lat: 31.5204, lng: 74.3587, facilityScore: 12, clinicName: 'City Dental Care' },
  ];
  const doctors = [];
  for (const d of doctorDefs) {
    const u = await prisma.user.create({ data: { email: d.email, password: await hash('doctor123'), role: 'doctor', isAgreed: true } });
    const doc = await prisma.doctorProfile.create({
      data: {
        userId: u.id, fullName: d.fullName, specialization: d.specialization, city: d.city,
        lat: d.lat, lng: d.lng, coordinates: `${d.lat}, ${d.lng}`, facilityScore: d.facilityScore,
        clinicName: d.clinicName, consultationFee: 1500, experience: 9, pmdcVerified: true,
        approvalStatus: 'approved', onlineStatus: 'online', clinicTiming: CLINIC_TIMING,
        clinicTier: d.facilityScore >= 31 ? 'elite' : d.facilityScore >= 16 ? 'modern' : 'standard',
        services: ['Air Conditioned', 'Digital X-Ray', 'Card Payment Accepted'],
      },
    });
    doctors.push(doc);
    await prisma.treatment.createMany({
      data: [
        { doctorId: doc.id, name: 'Teeth Whitening', priceMin: 5000, priceMax: 15000 },
        { doctorId: doc.id, name: 'Root Canal', priceMin: 8000, priceMax: 20000 },
        { doctorId: doc.id, name: 'Scaling & Polishing', priceMin: 2000, priceMax: 5000 },
      ],
    });
  }

  // Patients.
  const patientDefs = [
    { email: 'patient@mydentist.pk', fullName: 'Demo Patient', city: 'Islamabad', mobileNumber: '03001234567' },
    { email: 'patient2@mydentist.pk', fullName: 'Ali Raza', city: 'Lahore', mobileNumber: '03007654321' },
  ];
  const patients = [];
  for (const p of patientDefs) {
    const u = await prisma.user.create({ data: { email: p.email, password: await hash('patient123'), role: 'patient', isAgreed: true } });
    const pat = await prisma.patientProfile.create({ data: { userId: u.id, fullName: p.fullName, city: p.city, mobileNumber: p.mobileNumber, gender: 'other' } });
    patients.push(pat);
  }

  // A completed appointment + paid bill + review (patient0 with doctor0).
  const appt = await prisma.appointment.create({
    data: { patientId: patients[0].id, doctorId: doctors[0].id, treatmentType: 'Teeth Whitening', date: new Date(), time: '11:00', duration: 30, status: 'completed' },
  });
  await prisma.bill.create({
    data: { invoiceNumber: 'INV-SEED-001', appointmentId: appt.id, doctorId: doctors[0].id, patientId: patients[0].id, treatmentName: 'Teeth Whitening', amount: 10000, finalAmount: 10000, paidAmount: 10000, status: 'paid', paidAt: new Date(), commissionAccrued: 1000 },
  });
  await prisma.doctorProfile.update({ where: { id: doctors[0].id }, data: { commissionDue: 1000, rewardPoints: 100 } });
  await prisma.review.create({ data: { patientId: patients[0].id, doctorId: doctors[0].id, rating: 5, comment: 'Excellent service!', isVerifiedPatient: true } });
  await prisma.reward.create({ data: { patientId: patients[0].id, type: 'visit', points: 200, description: 'Points earned from treatment payment (2%)' } });

  const counts = {
    users: await prisma.user.count(), doctors: await prisma.doctorProfile.count(),
    patients: await prisma.patientProfile.count(), treatments: await prisma.treatment.count(),
    bills: await prisma.bill.count(), reviews: await prisma.review.count(),
  };
  console.log('✅ Seed complete:', counts);
  console.log('   Admin:   admin@mydentist.pk / admin123');
  console.log('   Doctor:  yasir@mydentist.pk / doctor123');
  console.log('   Patient: patient@mydentist.pk / patient123');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
