const mongoose = require('mongoose');

// Default clinic facility categories (admin-editable). Mirrors the app's
// original static config so existing behaviour is preserved until an admin edits.
const DEFAULT_FACILITY_CATEGORIES = [
  { key: 'hygiene', title: 'HYGIENE & STERILIZATION', icon: 'shield-checkmark', color: '#0052FF', bgColor: '#EFF6FF',
    items: ['Basic Sterilization', 'Autoclave Sterilization', 'UV Sterilization', 'Disposable Instruments', 'Instrument Pouch Sealing', 'Separate Sterilization Room', 'Infection Control System'] },
  { key: 'ppe', title: 'STAFF SAFETY PROTECTION (PPE)', icon: 'shield', color: '#16A34A', bgColor: '#F0FDF4',
    items: ['Surgical Gloves', 'Surgical Masks', 'Face Shields', 'Protective Gowns', 'Safety Glasses', 'Hand Sanitizer Availability'] },
  { key: 'equipment', title: 'DENTAL EQUIPMENT', icon: 'build', color: '#7C3AED', bgColor: '#F5F3FF',
    items: ['Digital X-Ray', 'RVG System', 'OPG Machine', 'Intra Oral Camera', 'Laser Dentistry', 'Implant Facility', 'Orthodontic Setup', 'Pediatric Dentistry'] },
  { key: 'facilities', title: 'CLINIC FACILITIES', icon: 'business', color: '#EA580C', bgColor: '#FFF7ED',
    items: ['Air Conditioned', 'Waiting Area', 'VIP Lounge', 'Drinking Water', 'Free Wi-Fi', 'Parking Available', 'Wheelchair Accessible', 'Kids Play Area', 'Prayer Area', 'Backup Generator'] },
  { key: 'emergency', title: 'EMERGENCY & SAFETY', icon: 'medkit', color: '#DC2626', bgColor: '#FEF2F2',
    items: ['Ambulance Service', 'Oxygen Cylinder', 'First Aid Kit', 'Fire Safety Equipment', '24/7 Emergency Support'] },
  { key: 'convenience', title: 'PATIENT CONVENIENCE', icon: 'phone-portrait', color: '#0D9488', bgColor: '#F0FDFA',
    items: ['Online Appointment Booking', 'Online Consultation', 'Card Payment Accepted', 'EasyPaisa/JazzCash', 'SMS/WhatsApp Reminder', 'Digital Prescription'] },
];

const facilityCategorySchema = new mongoose.Schema(
  { key: String, title: String, icon: String, color: String, bgColor: String, items: [String] },
  { _id: false }
);

// Single platform-wide settings document (only one row is ever used).
const appSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'global', unique: true },
    rewardPointsPerAppointment: { type: Number, default: 50 },
    rewardPointValuePkr: { type: Number, default: 1 }, // 1 point = X PKR on redemption
    defaultConsultationFee: { type: Number, default: 1500 },
    payments: {
      easypaisaNumber: { type: String, default: '' },
      easypaisaTitle:  { type: String, default: '' },
      jazzcashNumber:  { type: String, default: '' },
      jazzcashTitle:   { type: String, default: '' },
      bankAccount:     { type: String, default: '' },
      bankName:        { type: String, default: '' },
      bankTitle:       { type: String, default: '' },
    },
    // Which patient payment-method types are available in the app (admin-toggleable).
    enabledPaymentMethods: {
      type: [String],
      enum: ['visa', 'mastercard', 'easypaisa', 'jazzcash', 'bank'],
      default: ['visa', 'mastercard', 'easypaisa', 'jazzcash', 'bank'],
    },
    supportEmail: { type: String, default: '' },
    maintenanceMode: { type: Boolean, default: false },
    // Popular badge thresholds
    popularPointsThreshold: { type: Number, default: 20000 }, // green/earned at this many points
    popularPaidAmountPkr: { type: Number, default: 100000 },   // paid (blue) badge fee
    // Platform commission: percent of each doctor's collected billings owed to the platform.
    commissionRate: { type: Number, default: 10 }, // %
    campaignRotationInterval: { type: Number, default: 10 }, // patient promos, seconds
    doctorCampaignRotationInterval: { type: Number, default: 10 }, // doctor promos, seconds
    // Clinic facilities catalogue (admin-editable; the doctor app selects from these).
    facilityCategories: { type: [facilityCategorySchema], default: DEFAULT_FACILITY_CATEGORIES },
    // Clinic tier score ranges (min facility score for each tier).
    //   Standard: 1 .. (modern-1)   Modern: modern .. (elite-1)   Elite: elite+
    clinicTierThresholds: {
      modern: { type: Number, default: 16 },
      elite:  { type: Number, default: 31 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
// Exposed so controllers/routes can backfill facilities on settings docs created
// before this field existed (Mongoose defaults only apply to brand-new documents).
module.exports.DEFAULT_FACILITY_CATEGORIES = DEFAULT_FACILITY_CATEGORIES;
