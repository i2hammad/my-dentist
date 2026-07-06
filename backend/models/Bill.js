const mongoose = require('mongoose');

const billSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
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
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
    },
    treatmentName: {
      type: String,
      required: [true, 'Treatment name is required'],
    },
    // Per-treatment line items so editing a bill restores exact prices.
    treatments: [
      {
        name: { type: String, default: '' },
        price: { type: Number, default: 0 },
      },
    ],
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },
    discountFromRewards: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
    finalAmount: {
      type: Number,
      default: 0,
      min: [0, 'Final amount cannot be negative'],
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: [0, 'Paid amount cannot be negative'],
    },
    // Platform commission already accrued to the doctor's dues for THIS bill.
    // Reconciliation applies only the delta between this and the bill's current
    // target commission, so accrual is idempotent across create/edit/pay/unpay.
    commissionAccrued: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['paid', 'unpaid', 'draft', 'payment_pending', 'refunded'],
        message: '{VALUE} is not a valid bill status',
      },
      default: 'unpaid',
    },
    // How the bill was paid (recorded at pay time).
    paymentMethodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentMethod',
      default: null,
    },
    paymentMethodLabel: { type: String, default: '' },
    paymentType: {
      type: String,
      enum: ['card', 'wallet', 'cash', null],
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    // Refund (admin-issued) bookkeeping.
    refundReason: { type: String, default: '' },
    refundedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// Automatically set paidAt when status changes to paid
billSchema.pre('save', function (next) {
  if (this.isModified('status') && this.status === 'paid' && !this.paidAt) {
    this.paidAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);
