const prisma = require('../config/prisma');
const { serialize, remapMany } = require('../utils/serialize');

// @desc    Get user's saved payment methods
// @route   GET /api/payments/methods
// @access  Private
const getPaymentMethods = async (req, res) => {
  try {
    const methods = await prisma.paymentMethod.findMany({
      where: { userId: req.user._id },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.status(200).json({ success: true, count: methods.length, data: serialize(methods) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment methods', error: error.message });
  }
};

// @desc    Add a payment method
// @route   POST /api/payments/methods
// @access  Private
const addPaymentMethod = async (req, res) => {
  try {
    const { type, lastFourDigits, expiryDate, accountNumber, cardHolderName, bankName, iban } = req.body;
    const existingCount = await prisma.paymentMethod.count({ where: { userId: req.user._id } });

    const paymentMethod = await prisma.paymentMethod.create({
      data: {
        userId: req.user._id,
        type,
        lastFourDigits: lastFourDigits ?? null,
        cardHolderName: cardHolderName ?? null,
        expiryDate: expiryDate ?? null,
        accountNumber: accountNumber ?? null,
        bankName: bankName ?? null,
        iban: iban ?? null,
        isDefault: existingCount === 0,
      },
    });

    res.status(201).json({
      success: true,
      data: serialize(paymentMethod),
      message: existingCount === 0 ? 'Payment method added and set as default' : 'Payment method added successfully',
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ success: false, message: 'This payment method already exists' });
    }
    res.status(500).json({ success: false, message: 'Failed to add payment method', error: error.message });
  }
};

// @desc    Delete a payment method
// @route   DELETE /api/payments/methods/:id
// @access  Private
const deletePaymentMethod = async (req, res) => {
  try {
    const method = await prisma.paymentMethod.findUnique({ where: { id: req.params.id } });
    if (!method) return res.status(404).json({ success: false, message: 'Payment method not found' });
    if (method.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this payment method' });
    }

    const wasDefault = method.isDefault;
    await prisma.paymentMethod.delete({ where: { id: req.params.id } });

    if (wasDefault) {
      const next = await prisma.paymentMethod.findFirst({
        where: { userId: req.user._id },
        orderBy: { createdAt: 'desc' },
      });
      if (next) await prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } });
    }

    res.status(200).json({ success: true, message: 'Payment method deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete payment method', error: error.message });
  }
};

// @desc    Set a payment method as default
// @route   PUT /api/payments/methods/:id/default
// @access  Private
const setDefaultPaymentMethod = async (req, res) => {
  try {
    const method = await prisma.paymentMethod.findUnique({ where: { id: req.params.id } });
    if (!method) return res.status(404).json({ success: false, message: 'Payment method not found' });
    if (method.userId !== req.user._id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this payment method' });
    }

    await prisma.paymentMethod.updateMany({
      where: { userId: req.user._id, id: { not: req.params.id } },
      data: { isDefault: false },
    });
    const updated = await prisma.paymentMethod.update({ where: { id: req.params.id }, data: { isDefault: true } });

    res.status(200).json({ success: true, data: serialize(updated), message: 'Default payment method updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to set default payment method', error: error.message });
  }
};

// @desc    Get payment history (paid bills)
// @route   GET /api/payments/history
// @access  Private
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const where = { patientId: patientProfile.id, status: 'paid' };
    const [total, bills] = await Promise.all([
      prisma.bill.count({ where }),
      prisma.bill.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { doctor: { select: { id: true, fullName: true } } },
      }),
    ]);

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(remapMany(bills, { doctor: 'doctorId' })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment history', error: error.message });
  }
};

module.exports = { getPaymentMethods, addPaymentMethod, deletePaymentMethod, setDefaultPaymentMethod, getPaymentHistory };
