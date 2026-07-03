const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    type: {
      type: String,
      enum: {
        values: ['visa', 'mastercard', 'easypaisa', 'jazzcash', 'bank'],
        message: '{VALUE} is not a supported payment method',
      },
      required: [true, 'Payment method type is required'],
    },
    lastFourDigits: {
      type: String,
      default: null,
      maxlength: [4, 'Last four digits cannot exceed 4 characters'],
    },
    cardHolderName: {
      type: String,
      default: null,
      trim: true,
    },
    expiryDate: {
      type: String,
      default: null,
    },
    accountNumber: {
      type: String,
      default: null,
    },
    // Bank-account type: cardHolderName = title of account, accountNumber = account #.
    bankName: {
      type: String,
      default: null,
      trim: true,
    },
    iban: {
      type: String,
      default: null,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default payment method per user
paymentMethodSchema.pre('save', async function (next) {
  if (this.isDefault && this.isModified('isDefault')) {
    try {
      await this.constructor.updateMany(
        { userId: this.userId, _id: { $ne: this._id } },
        { isDefault: false }
      );
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
