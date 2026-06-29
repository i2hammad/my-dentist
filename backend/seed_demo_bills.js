// Seed ~100 sample bills for the DEMO DOCTOR, spread across multiple patients.
// Run: node seed_demo_bills.js
const mongoose = require('mongoose');
require('dotenv').config();
const DoctorProfile = require('./models/DoctorProfile');
const PatientProfile = require('./models/PatientProfile');
const Bill = require('./models/Bill');

const DEMO_DOCTOR_EMAIL = 'demo.doctor@mydentist.com';
const TOTAL_BILLS = 100;
const NUM_PATIENTS = 14; // spread the bills across this many patients

const TREATMENTS = [
  { name: 'Consultation', min: 1000, max: 2000 },
  { name: 'Scaling & Polishing', min: 3000, max: 6000 },
  { name: 'Tooth Extraction', min: 2500, max: 5000 },
  { name: 'Root Canal Treatment (RCT)', min: 12000, max: 25000 },
  { name: 'Dental Filling', min: 2000, max: 4500 },
  { name: 'Teeth Whitening', min: 8000, max: 15000 },
  { name: 'Crown / Cap', min: 10000, max: 22000 },
  { name: 'Braces Adjustment', min: 4000, max: 9000 },
  { name: 'Dental Implant', min: 40000, max: 90000 },
  { name: 'X-Ray', min: 800, max: 1500 },
];
const STATUSES = ['paid', 'paid', 'paid', 'unpaid', 'unpaid', 'draft']; // weighted toward paid

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const round = (n) => Math.round(n / 50) * 50;

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const DoctorUser = require('./models/User');
    const docUser = await DoctorUser.findOne({ email: DEMO_DOCTOR_EMAIL });
    const doctor = docUser
      ? await DoctorProfile.findOne({ userId: docUser._id })
      : await DoctorProfile.findOne({ fullName: /demo/i });
    if (!doctor) throw new Error('Demo doctor profile not found');
    console.log('Demo doctor:', doctor.fullName, doctor._id.toString());

    // Pick a set of patients to bill (prefer real-looking ones; fall back to any).
    const patients = await PatientProfile.find().limit(NUM_PATIENTS).select('fullName');
    if (!patients.length) throw new Error('No patient profiles found');
    console.log(`Distributing ${TOTAL_BILLS} bills across ${patients.length} patients`);

    // Unique invoice prefix for this batch so we never collide with existing invoices.
    const batchTag = `DEMO-${Date.now().toString().slice(-6)}`;

    const docs = [];
    for (let i = 0; i < TOTAL_BILLS; i++) {
      const patient = patients[i % patients.length];
      const t = pick(TREATMENTS);
      const amount = round(rand(t.min, t.max));
      const hasDiscount = Math.random() < 0.35;
      const discount = hasDiscount ? round(Math.min(amount * 0.2, rand(200, 2000))) : 0;
      const finalAmount = Math.max(0, amount - discount);
      const status = pick(STATUSES);
      const paidAmount = status === 'paid' ? finalAmount : status === 'unpaid' ? round(finalAmount * (Math.random() < 0.4 ? 0.5 : 0)) : 0;

      // Spread createdAt over the last ~120 days.
      const daysAgo = rand(0, 120);
      const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      docs.push({
        patientId: patient._id,
        doctorId: doctor._id,
        invoiceNumber: `${batchTag}-${String(i + 1).padStart(3, '0')}`,
        treatmentName: t.name,
        amount,
        discountFromRewards: discount,
        finalAmount,
        paidAmount,
        status,
        paidAt: status === 'paid' ? created : null,
        createdAt: created,
        updatedAt: created,
      });
    }

    const inserted = await Bill.insertMany(docs, { ordered: false });
    console.log(`✅ Inserted ${inserted.length} bills (invoice prefix ${batchTag})`);

    // Quick summary
    const byStatus = inserted.reduce((m, b) => { m[b.status] = (m[b.status] || 0) + 1; return m; }, {});
    console.log('By status:', byStatus);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
