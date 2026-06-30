const mongoose = require('mongoose');

const patientProfileSchema = new mongoose.Schema(
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
    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: {
        values: ['male', 'female', 'other'],
        message: '{VALUE} is not a valid gender',
      },
      default: null,
    },
    city: {
      type: String,
      trim: true,
      default: '',
    },
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
    profileImage: {
      type: String,
      default: '',
    },
    age: { type: Number, default: null },
    address: { type: String, default: '' },
    coordinates: { type: String, default: '' },
    // ── Family members ──
    familyMembers: [{
      name: { type: String, required: true },
      relation: { type: String, enum: ['Spouse', 'Child', 'Parent', 'Sibling', 'Other'], default: 'Other' },
      age: { type: Number },
      gender: { type: String, enum: ['male', 'female', 'other'] },
    }],
    // ── Referral program ──
    referralCode: { type: String, unique: true, sparse: true }, // this patient's own code to share
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'PatientProfile', default: null }, // who referred them
    referralRewarded: { type: Boolean, default: false }, // 100/100 awarded after 1st completed treatment
    // Admin suspend/ban.
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String, default: '' },
  },
  {
    timestamps: true,
  }
);

patientProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('PatientProfile', patientProfileSchema);
