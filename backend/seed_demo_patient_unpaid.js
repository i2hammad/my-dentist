// Seed a few UNPAID bills for the DEMO PATIENT (from the demo doctor) so the
// "Pay Now" button can be tested in the patient Bills tab.
// Run: node seed_demo_patient_unpaid.js
const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const DoctorProfile = require('./models/DoctorProfile');
const PatientProfile = require('./models/PatientProfile');
const Bill = require('./models/Bill');

const PATIENT_EMAIL = 'demo.patient@mydentist.com';
const DOCTOR_EMAIL = 'demo.doctor@mydentist.com';
const COUNT = 5;

const TREATMENTS = [
  { name: 'Scaling & Polishing', amount: 4500 },
  { name: 'Tooth Extraction', amount: 3500 },
  { name: 'Root Canal Treatment (RCT)', amount: 18000 },
  { name: 'Dental Filling', amount: 3000 },
  { name: 'Consultation', amount: 1500 },
];

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const pUser = await User.findOne({ email: PATIENT_EMAIL });
    const dUser = await User.findOne({ email: DOCTOR_EMAIL });
    const patient = pUser && await PatientProfile.findOne({ userId: pUser._id });
    const doctor = dUser && await DoctorProfile.findOne({ userId: dUser._id });
    if (!patient) throw new Error('Demo patient profile not found');
    if (!doctor) throw new Error('Demo doctor profile not found');
    console.log('Patient:', patient.fullName, '| Doctor:', doctor.fullName);

    const tag = `UNPAID-${Date.now().toString().slice(-6)}`;
    const docs = TREATMENTS.slice(0, COUNT).map((t, i) => {
      const daysAgo = i * 3;
      const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const discount = i % 2 === 0 ? 0 : 500;
      return {
        patientId: patient._id,
        doctorId: doctor._id,
        invoiceNumber: `${tag}-${String(i + 1).padStart(2, '0')}`,
        treatmentName: t.name,
        amount: t.amount,
        discountFromRewards: discount,
        finalAmount: t.amount - discount,
        paidAmount: 0,
        status: 'unpaid',
        paidAt: null,
        createdAt: created,
        updatedAt: created,
      };
    });

    const inserted = await Bill.insertMany(docs);
    console.log(`✅ Inserted ${inserted.length} UNPAID bills for the demo patient (prefix ${tag})`);
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
})();
