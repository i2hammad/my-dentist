const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: [true, 'Patient ID is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: [true, 'Doctor ID is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      trim: true,
      default: '',
    },
    isVerifiedPatient: {
      type: Boolean,
      default: false,
    },
    // Admin moderation — hidden reviews are excluded from public feeds + ratings.
    hidden: {
      type: Boolean,
      default: false,
    },
    helpfulCount: {
      type: Number,
      default: 0,
      min: [0, 'Helpful count cannot be negative'],
    },
    helpfulBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Doctor's reply to this review.
    doctorReply: {
      text: { type: String, default: '' },
      repliedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ doctorId: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
