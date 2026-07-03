const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: [true, 'Patient ID is required'],
    },
    // Links a review/visit reward to the doctor it was earned from. Used to ensure
    // review points are granted only ONCE per patient per doctor (a delete + re-review
    // must not farm points again).
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      default: null,
    },
    type: {
      type: String,
      enum: {
        values: ['visit', 'referral', 'review'],
        message: '{VALUE} is not a valid reward type',
      },
      required: [true, 'Reward type is required'],
    },
    points: {
      type: Number,
      required: [true, 'Points are required'],
      min: [0, 'Points cannot be negative'],
    },
    description: {
      type: String,
      default: '',
    },
    referralCode: {
      type: String,
      default: null,
    },
    isRedeemed: {
      type: Boolean,
      default: false,
    },
    // Prevents awarding duplicate points for the same bill across payment paths.
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bill',
      default: null,
    },
    // Set once a doctor applies the redeem code to a bill (prevents reuse).
    appliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Reward', rewardSchema);
