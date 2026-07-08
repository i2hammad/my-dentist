// Default AppSettings JSON values (Prisma Json columns have no schema defaults,
// so getOrCreateSettings / the seed apply these on first create).

const DEFAULT_FACILITY_CATEGORIES = [
  { key: 'hygiene', title: 'HYGIENE & STERILIZATION', icon: 'shield-checkmark', color: '#0052FF', bgColor: '#EFF6FF', items: ['Basic Sterilization', 'Autoclave Sterilization', 'UV Sterilization', 'Disposable Instruments', 'Instrument Pouch Sealing', 'Separate Sterilization Room', 'Infection Control System'] },
  { key: 'ppe', title: 'STAFF SAFETY PROTECTION (PPE)', icon: 'shield', color: '#16A34A', bgColor: '#F0FDF4', items: ['Surgical Gloves', 'Surgical Masks', 'Face Shields', 'Protective Gowns', 'Safety Glasses', 'Hand Sanitizer Availability'] },
  { key: 'equipment', title: 'DENTAL EQUIPMENT', icon: 'build', color: '#7C3AED', bgColor: '#F5F3FF', items: ['Digital X-Ray', 'RVG System', 'OPG Machine', 'Intra Oral Camera', 'Laser Dentistry', 'Implant Facility', 'Orthodontic Setup', 'Pediatric Dentistry'] },
  { key: 'facilities', title: 'CLINIC FACILITIES', icon: 'business', color: '#EA580C', bgColor: '#FFF7ED', items: ['Air Conditioned', 'Waiting Area', 'VIP Lounge', 'Drinking Water', 'Free Wi-Fi', 'Parking Available', 'Wheelchair Accessible', 'Kids Play Area', 'Prayer Area', 'Backup Generator'] },
  { key: 'emergency', title: 'EMERGENCY & SAFETY', icon: 'medkit', color: '#DC2626', bgColor: '#FEF2F2', items: ['Ambulance Service', 'Oxygen Cylinder', 'First Aid Kit', 'Fire Safety Equipment', '24/7 Emergency Support'] },
  { key: 'convenience', title: 'PATIENT CONVENIENCE', icon: 'phone-portrait', color: '#0D9488', bgColor: '#F0FDFA', items: ['Online Appointment Booking', 'Online Consultation', 'Card Payment Accepted', 'EasyPaisa/JazzCash', 'SMS/WhatsApp Reminder', 'Digital Prescription'] },
];

const DEFAULT_TIER_THRESHOLDS = { modern: 16, elite: 31 };

const DEFAULT_PAYMENTS = {
  easypaisaNumber: '', easypaisaTitle: '',
  jazzcashNumber: '', jazzcashTitle: '',
  bankAccount: '', bankName: '', bankTitle: '',
};

module.exports = { DEFAULT_FACILITY_CATEGORIES, DEFAULT_TIER_THRESHOLDS, DEFAULT_PAYMENTS };
