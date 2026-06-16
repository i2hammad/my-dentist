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
    pmdcVerified: {
      type: Boolean,
      default: false,
    },
    languages: {
      type: [String],
      default: ['English', 'Urdu'],
    },
    clinicTiming: {
      days: {
        type: String,
        default: 'Mon - Sat',
      },
      startTime: {
        type: String,
        default: '10:00 AM',
      },
      endTime: {
        type: String,
        default: '08:00 PM',
      },
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
  },
  {
    timestamps: true,
  }
);

doctorProfileSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema);
