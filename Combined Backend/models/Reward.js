const mongoose = require('mongoose');

const rewardSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientProfile',
      required: [true, 'Patient ID is required'],
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
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Reward', rewardSchema);
