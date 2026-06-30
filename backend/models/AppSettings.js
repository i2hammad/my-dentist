const mongoose = require('mongoose');

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
    supportEmail: { type: String, default: '' },
    maintenanceMode: { type: Boolean, default: false },
    // Popular badge thresholds
    popularPointsThreshold: { type: Number, default: 20000 }, // green/earned at this many points
    popularPaidAmountPkr: { type: Number, default: 100000 },   // paid (blue) badge fee
    // Platform commission: percent of each doctor's collected billings owed to the platform.
    commissionRate: { type: Number, default: 10 }, // %
    campaignRotationInterval: { type: Number, default: 10 }, // patient promos, seconds
    doctorCampaignRotationInterval: { type: Number, default: 10 }, // doctor promos, seconds
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppSettings', appSettingsSchema);
