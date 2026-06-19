const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
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
    treatmentType: {
      type: String,
      required: [true, 'Treatment type is required'],
    },
    description: {
      type: String,
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type: String,
      required: [true, 'Appointment time is required'],
    },
    duration: {
      type: Number,
      default: 30,
      min: [5, 'Duration must be at least 5 minutes'],
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'completed', 'cancelled'],
        message: '{VALUE} is not a valid appointment status',
      },
      default: 'pending',
    },
    consultationType: {
      type: String,
      enum: ['online', 'offline'],
      default: 'offline',
    },
    visitSummary: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({ patientId: 1, date: -1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
