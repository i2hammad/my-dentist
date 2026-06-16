const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient ID is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: [true, 'Doctor ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

favoriteSchema.index({ patientId: 1, doctorId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
