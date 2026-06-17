const mongoose = require('mongoose');

// Promotional campaign (e.g. medicine marketing) shown to doctors as a banner.
const campaignSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    // Short text shown on the small banner itself.
    bannerText: { type: String, default: '', trim: true },
    // Full marketing content shown on the detail page (admin-written).
    body: { type: String, default: '' },
    medicineName: { type: String, default: '', trim: true },
    company: { type: String, default: '', trim: true },
    bannerImage: { type: String, default: '' }, // Cloudinary URL — small banner
    detailImage: { type: String, default: '' }, // Cloudinary URL — full page
    ctaLabel: { type: String, default: 'Learn More' },
    ctaLink: { type: String, default: '' }, // optional external URL

    // Targeting: empty cities array = show to ALL doctors.
    cities: { type: [String], default: [] },

    // Scheduling window.
    startAt: { type: Date, required: [true, 'Start date is required'] },
    endAt: { type: Date, required: [true, 'End date is required'] },
    isActive: { type: Boolean, default: true },

    // Analytics.
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Is the campaign currently live (active + within its date window)?
campaignSchema.methods.isLive = function (now = new Date()) {
  return this.isActive && this.startAt <= now && this.endAt >= now;
};

module.exports = mongoose.model('Campaign', campaignSchema);
