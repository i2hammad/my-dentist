const mongoose = require('mongoose');

const doctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    photo: {
      type: String,
      default: '',
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
    },
    pmdcNumber: {
      type: String,
      default: '',
      trim: true,
    },
    gender: {
      type: String,
      default: '',
      trim: true,
    },
    clinicContact: {
      type: String,
      default: '',
      trim: true,
    },
    city: {
      type: String,
      default: '',
      trim: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    licenseCert: {
      type: String,
      default: '',
    },
    idFront: {
      type: String,
      default: '',
    },
    idBack: {
      type: String,
      default: '',
    },
    qualification: {
      type: String,
      trim: true,
      default: '',
    },
    consultationFee: {
      type: Number,
      default: 1500,
      min: [0, 'Consultation fee cannot be negative'],
    },
    experience: {
      type: Number,
      default: 0,
      min: [0, 'Experience cannot be negative'],
    },
    clinicName: {
      type: String,
      trim: true,
      default: '',
    },
    clinicTier: {
      type: String,
      enum: {
        values: ['elite', 'modern', 'standard'],
        message: '{VALUE} is not a valid clinic tier',
      },
      default: 'standard',
    },
    facilityScore: {
      type: Number,
      default: 0,
      min: [0, 'Facility score cannot be negative'],
    },
    // Doctor's bank account for receiving "My Dentist" payouts (90% of payments
    // patients made into the platform accounts).
    payoutAccount: {
      bankName: { type: String, default: '' },
      accountTitle: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
    },
    pmdcVerified: {
      type: Boolean,
      default: false,
    },
    languages: {
      type: [String],
      default: ['English', 'Urdu'],
    },
    clinicTiming: {
      // Legacy single range (kept for backward compatibility).
      days: { type: String, default: 'Mon - Sat' },
      startTime: { type: String, default: '10:00 AM' },
      endTime: { type: String, default: '08:00 PM' },
      // Morning & evening session ranges.
      morningStart: { type: String, default: '' },
      morningEnd: { type: String, default: '' },
      eveningStart: { type: String, default: '' },
      eveningEnd: { type: String, default: '' },
      // Available working days + clinic off days (e.g. ['Sunday']).
      availableDays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
      offDays: { type: [String], default: ['Sun'] },
    },
    onlineStatus: {
      type: String,
      enum: {
        values: ['online', 'busy', 'offline'],
        message: '{VALUE} is not a valid online status',
      },
      default: 'offline',
    },
    about: {
      type: String,
      default: '',
    },
    address: {
      type: String,
      default: '',
    },
    // Human-readable "lat, lng" string mirrored to the frontend (matches
    // PatientProfile.coordinates). The 2dsphere `location` below is the
    // canonical geo field used for proximity queries.
    coordinates: { type: String, default: '' },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    services: {
      type: [String],
      default: [],
    },
    // ── Popular status ──
    // Doctor's accumulated reward points. At >= 20000 they auto-earn the
    // green "popular" badge. Admins can also grant a paid (blue) badge.
    rewardPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    // Admin approval: a new doctor's profile is inactive until an admin approves.
    approvalStatus: {
      type: String,
      enum: { values: ['pending', 'approved', 'rejected'], message: '{VALUE} is not a valid approval status' },
      default: 'pending',
    },
    // Account block (e.g. for outstanding commission dues); admin can unblock.
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
      default: '',
    },
    // Outstanding commission owed to the platform (PKR). Auto-blocks at 50k.
    commissionDue: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Total commission the doctor has paid/cleared to the platform over time (PKR).
    commissionPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    // 'earned' = reached 20k points (green) · 'paid' = admin-granted (blue) · null = not popular
    popularType: {
      type: String,
      enum: {
        values: ['earned', 'paid', null],
        message: '{VALUE} is not a valid popular type',
      },
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

doctorProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);
