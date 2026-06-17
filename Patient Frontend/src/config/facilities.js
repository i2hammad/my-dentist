// Predefined clinic facility categories — shared by Clinic Setup (scoring)
// and the Reviews tab (facilities/services selection). Doctors can only
// choose from these; no free-text custom entries.
export const FACILITY_CATEGORIES = [
  {
    key: 'hygiene', title: 'HYGIENE & STERILIZATION', icon: 'shield-checkmark', color: '#0052FF', bgColor: '#EFF6FF',
    items: ['Basic Sterilization', 'Autoclave Sterilization', 'UV Sterilization', 'Disposable Instruments', 'Instrument Pouch Sealing', 'Separate Sterilization Room', 'Infection Control System'],
  },
  {
    key: 'ppe', title: 'STAFF SAFETY PROTECTION (PPE)', icon: 'shield', color: '#16A34A', bgColor: '#F0FDF4',
    items: ['Surgical Gloves', 'Surgical Masks', 'Face Shields', 'Protective Gowns', 'Safety Glasses', 'Hand Sanitizer Availability'],
  },
  {
    key: 'equipment', title: 'DENTAL EQUIPMENT', icon: 'build', color: '#7C3AED', bgColor: '#F5F3FF',
    items: ['Digital X-Ray', 'RVG System', 'OPG Machine', 'Intra Oral Camera', 'Laser Dentistry', 'Implant Facility', 'Orthodontic Setup', 'Pediatric Dentistry'],
  },
  {
    key: 'facilities', title: 'CLINIC FACILITIES', icon: 'business', color: '#EA580C', bgColor: '#FFF7ED',
    items: ['Air Conditioned', 'Waiting Area', 'VIP Lounge', 'Drinking Water', 'Free Wi-Fi', 'Parking Available', 'Wheelchair Accessible', 'Kids Play Area', 'Prayer Area', 'Backup Generator'],
  },
  {
    key: 'emergency', title: 'EMERGENCY & SAFETY', icon: 'medkit', color: '#DC2626', bgColor: '#FEF2F2',
    items: ['Ambulance Service', 'Oxygen Cylinder', 'First Aid Kit', 'Fire Safety Equipment', '24/7 Emergency Support'],
  },
  {
    key: 'convenience', title: 'PATIENT CONVENIENCE', icon: 'phone-portrait', color: '#0D9488', bgColor: '#F0FDFA',
    items: ['Online Appointment Booking', 'Online Consultation', 'Card Payment Accepted', 'EasyPaisa/JazzCash', 'SMS/WhatsApp Reminder', 'Digital Prescription'],
  },
];

// Flat list of all available facility names.
export const ALL_FACILITIES = FACILITY_CATEGORIES.flatMap((c) => c.items);
