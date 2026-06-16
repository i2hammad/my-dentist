const mongoose = require('mongoose');

const adminProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    // 'super_admin' has all permissions implicitly; 'admin' is scoped by `permissions`.
    adminRole: {
      type: String,
      enum: {
        values: ['super_admin', 'admin'],
        message: '{VALUE} is not a valid admin role',
      },
      default: 'admin',
    },
    // Section-level access flags (matches the Permissions column in the UI).
    permissions: {
      type: [String],
      default: [
        'dashboard', 'admins', 'dentists', 'patients', 'treatments',
        'gallery', 'reviews', 'appointments', 'bills', 'rewards',
      ],
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    profileImage: {
      type: String,
      default: '',
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminProfile', adminProfileSchema);
