const mongoose = require('mongoose');

// Records an admin action (who did what, when) for the activity log.
const auditLogSchema = new mongoose.Schema(
  {
    // The admin User who performed the action.
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, default: '' },   // denormalized for fast display
    // Verb performed: create | update | delete | broadcast | login | other.
    action: { type: String, required: true },
    // The kind of entity acted on: 'patient', 'dentist', 'treatment', etc.
    entity: { type: String, default: '' },
    // The affected entity id (string — may reference different collections).
    entityId: { type: String, default: '' },
    // Human-readable summary, e.g. 'Deleted patient "Ahmed Raza"'.
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
