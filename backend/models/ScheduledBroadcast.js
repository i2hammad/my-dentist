const mongoose = require('mongoose');

// A broadcast queued to send at a future time. A cron-callable endpoint
// (POST/GET /api/cron/process-broadcasts) sends any that are due.
const scheduledBroadcastSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: { type: String, enum: ['all', 'patient', 'doctor'], default: 'all' },
    city: { type: String, default: '' },
    sendAt: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'sent', 'cancelled', 'failed'], default: 'scheduled' },
    sentCount: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
    error: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

scheduledBroadcastSchema.index({ status: 1, sendAt: 1 });

module.exports = mongoose.model('ScheduledBroadcast', scheduledBroadcastSchema);
