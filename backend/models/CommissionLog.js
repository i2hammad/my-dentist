const mongoose = require('mongoose');

// One entry per commission dues change (add / clear / sync) for a doctor.
const commissionLogSchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorProfile', required: true, index: true },
    doctorName: { type: String, default: '' },
    // 'add' = dues increased · 'clear' = dues paid/cleared · 'sync' = recomputed from bills · 'set' = set to absolute
    type: { type: String, enum: ['add', 'clear', 'sync', 'set'], required: true },
    amount: { type: Number, default: 0 },        // the change amount (PKR)
    balanceAfter: { type: Number, default: 0 },   // commissionDue after the change
    note: { type: String, default: '' },
    actorName: { type: String, default: '' },     // admin who performed it
  },
  { timestamps: true }
);

commissionLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CommissionLog', commissionLogSchema);
