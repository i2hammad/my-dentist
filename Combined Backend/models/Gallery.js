const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DoctorProfile',
      required: [true, 'Doctor ID is required'],
    },
    category: {
      type: String,
      enum: {
        values: ['clinic_photo', 'clinic_photos', 'before_after', 'certificate', 'certificates'],
        message: '{VALUE} is not a valid gallery category',
      },
      required: [true, 'Gallery category is required'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    title: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    beforeImage: {
      type: String,
      default: null,
    },
    afterImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Gallery', gallerySchema);
