const PaymentMethod = require('../models/PaymentMethod');

// @desc    Get user's saved payment methods
// @route   GET /api/payments/methods
// @access  Private
const getPaymentMethods = async (req, res) => {
  try {
    const methods = await PaymentMethod.find({ userId: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: methods.length,
      data: methods,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment methods',
      error: error.message,
    });
  }
};

// @desc    Add a payment method
// @route   POST /api/payments/methods
// @access  Private
const addPaymentMethod = async (req, res) => {
  try {
    const { type, lastFourDigits, expiryDate, accountNumber } = req.body;

    // Check if this is the user's first payment method
    const existingCount = await PaymentMethod.countDocuments({
      userId: req.user._id,
    });

    const paymentMethod = await PaymentMethod.create({
      userId: req.user._id,
      type,
      lastFourDigits,
      expiryDate,
      accountNumber,
      isDefault: existingCount === 0, // Auto-set first method as default
    });

    res.status(201).json({
      success: true,
      data: paymentMethod,
      message: existingCount === 0
        ? 'Payment method added and set as default'
        : 'Payment method added successfully',
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'This payment method already exists',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add payment method',
      error: error.message,
    });
  }
};

// @desc    Delete a payment method
// @route   DELETE /api/payments/methods/:id
// @access  Private
const deletePaymentMethod = async (req, res) => {
  try {
    const method = await PaymentMethod.findById(req.params.id);

    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found',
      });
    }

    // Verify ownership
    if (method.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this payment method',
      });
    }

    const wasDefault = method.isDefault;

    await PaymentMethod.findByIdAndDelete(req.params.id);

    // If deleted method was the default, set another one as default
    if (wasDefault) {
      const nextDefault = await PaymentMethod.findOne({
        userId: req.user._id,
      }).sort({ createdAt: -1 });

      if (nextDefault) {
        nextDefault.isDefault = true;
        await nextDefault.save();
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: error.message,
    });
  }
};

// @desc    Set a payment method as default
// @route   PUT /api/payments/methods/:id/default
// @access  Private
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const method = await PaymentMethod.findById(req.params.id);

    if (!method) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found',
      });
    }

    // Verify ownership
    if (method.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this payment method',
      });
    }

    // Unset all other defaults for this user
    await PaymentMethod.updateMany(
      { userId: req.user._id, _id: { $ne: req.params.id } },
      { $set: { isDefault: false } }
    );

    // Set this one as default
    method.isDefault = true;
    await method.save();

    res.status(200).json({
      success: true,
      data: method,
      message: 'Default payment method updated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to set default payment method',
      error: error.message,
    });
  }
};

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const PatientProfile = require('../models/PatientProfile');
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    const Bill = require('../models/Bill');

    const query = {
      patientId: patientProfile._id,
      status: 'paid',
    };

    const total = await Bill.countDocuments(query);

    const bills = await Bill.find(query)
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('doctorId', 'email')
      .lean();

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bills,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history',
      error: error.message,
    });
  }
};

module.exports = {
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  getPaymentHistory,
};
