const mongoose = require('mongoose');

const treatmentSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: [true, 'Doctor ID is required'],
    },
    name: {
      type: String,
      required: [true, 'Treatment name is required'],
      trim: true,
    },
    priceMin: {
      type: Number,
      default: 0,
      min: [0, 'Minimum price cannot be negative'],
    },
    priceMax: {
      type: Number,
      default: 0,
      min: [0, 'Maximum price cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Validate that priceMax >= priceMin
treatmentSchema.pre('validate', function (next) {
  if (this.priceMax < this.priceMin) {
    this.invalidate(
      'priceMax',
      'Maximum price must be greater than or equal to minimum price'
    );
  }
  next();
});

module.exports = mongoose.model('Treatment', treatmentSchema);
