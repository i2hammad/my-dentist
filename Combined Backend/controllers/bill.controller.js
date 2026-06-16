const Bill = require('../models/Bill');
const PatientProfile = require('../models/PatientProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Reward = require('../models/Reward');
const Notification = require('../models/Notification');
const { generateInvoiceNumber } = require('../utils/invoiceGenerator');

// @desc    Get current user's bills (paginated)
// @route   GET /api/bills/my
// @access  Private
const getMyBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (req.user.role === 'patient') {
      const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
      if (!patientProfile) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found'
        });
      }
      filter.patientId = patientProfile._id;
    } else if (req.user.role === 'doctor') {
      const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
      if (!doctorProfile) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found'
        });
      }
      filter.doctorId = doctorProfile._id;
    }

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .populate({ path: 'doctorId', select: 'fullName clinicName specialization' })
        .populate({ path: 'patientId', select: 'fullName' })
        .populate({ path: 'appointmentId', select: 'treatmentType date time' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bill.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bills',
      error: error.message
    });
  }
};

// @desc    Get billing summary for patient
// @route   GET /api/bills/summary
// @access  Private (Patient only)
const getBillingSummary = async (req, res) => {
  try {
    const patientProfile = await PatientProfile.findOne({ userId: req.user._id });
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found'
      });
    }

    const summary = await Bill.aggregate([
      { $match: { patientId: patientProfile._id } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          totalPaid: {
            $sum: {
              $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0]
            }
          },
          totalDiscount: { $sum: { $ifNull: ['$discountFromRewards', 0] } },
          outstanding: {
            $sum: {
              $cond: [{ $ne: ['$status', 'paid'] }, '$amount', 0]
            }
          }
        }
      }
    ]);

    const data = summary.length > 0
      ? {
          totalBills: summary[0].totalBills,
          totalPaid: summary[0].totalPaid,
          totalDiscount: summary[0].totalDiscount,
          outstanding: summary[0].outstanding
        }
      : {
          totalBills: 0,
          totalPaid: 0,
          totalDiscount: 0,
          outstanding: 0
        };

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing summary',
      error: error.message
    });
  }
};

// @desc    Get single bill detail
// @route   GET /api/bills/:id
// @access  Private
const getBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate({ path: 'appointmentId', select: 'treatmentType date time status description' })
      .populate({ path: 'doctorId', select: 'fullName clinicName specialization userId' })
      .populate({ path: 'patientId', select: 'fullName userId' });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Authorization: only the involved patient or doctor (or admin) can view
    const isPatient = bill.patientId &&
      bill.patientId.userId &&
      bill.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = bill.doctorId &&
      bill.doctorId.userId &&
      bill.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this bill'
      });
    }

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bill',
      error: error.message
    });
  }
};

// @desc    Create a new bill
// @route   POST /api/bills
// @access  Private (Doctor only)
const createBill = async (req, res) => {
  try {
    const { appointmentId, patientId, treatmentName, amount, dueDate, discountFromRewards } = req.body;

    // Verify doctor profile
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    // Verify patient exists
    const patientProfile = await PatientProfile.findById(patientId);
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // Check for duplicate bill for the same appointment
    if (appointmentId) {
      const existingBill = await Bill.findOne({ appointmentId });
      if (existingBill) {
        return res.status(409).json({
          success: false,
          message: 'A bill already exists for this appointment'
        });
      }
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();

    // Calculate final amount
    const discount = discountFromRewards || 0;
    const finalAmount = Math.max(amount - discount, 0);

    const bill = await Bill.create({
      invoiceNumber,
      appointmentId,
      doctorId: doctorProfile._id,
      patientId,
      treatmentName,
      amount,
      finalAmount,
      discountFromRewards: discount,
      dueDate: new Date(dueDate),
      status: 'unpaid'
    });

    // Create notification for patient
    await Notification.create({
      userId: patientProfile.userId,
      type: 'bill',
      title: 'New Bill Generated',
      message: `A new bill of $${finalAmount.toFixed(2)} for ${treatmentName} has been generated. Invoice: ${invoiceNumber}.`,
      relatedId: bill._id,
      data: { doctorId: String(doctorProfile._id) }
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully',
      data: bill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create bill',
      error: error.message
    });
  }
};

// @desc    Pay a bill
// @route   PUT /api/bills/:id/pay
// @access  Private (Patient only)
const payBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate({ path: 'patientId', select: 'userId fullName' })
      .populate({ path: 'doctorId', select: 'userId fullName' });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Only the bill's patient can pay
    const isPatient = bill.patientId &&
      bill.patientId.userId &&
      bill.patientId.userId.toString() === req.user._id.toString();

    if (!isPatient) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to pay this bill'
      });
    }

    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Bill is already paid'
      });
    }

    // Mark as paid
    bill.status = 'paid';
    bill.paidAt = new Date();
    await bill.save();

    // Create reward entry for the patient (2% of amount)
    const rewardPoints = Math.floor(bill.amount * 0.02);
    if (rewardPoints > 0) {
      await Reward.create({
        patientId: bill.patientId._id,
        type: 'visit',
        points: rewardPoints,
        description: 'Points earned from payment'
      });
    }

    // Notify the doctor
    await Notification.create({
      userId: bill.doctorId.userId,
      type: 'bill',
      title: 'Bill Payment Received',
      message: `${bill.patientId.fullName} has paid bill ${bill.invoiceNumber} ($${bill.amount.toFixed(2)}).`,
      relatedId: bill._id
    });

    res.status(200).json({
      success: true,
      message: 'Bill paid successfully',
      data: {
        bill,
        rewardPointsEarned: rewardPoints
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
};

// @desc    Download bill data (simulated — returns JSON)
// @route   GET /api/bills/:id/download
// @access  Private
const downloadBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate({ path: 'appointmentId', select: 'treatmentType date time' })
      .populate({ path: 'doctorId', select: 'fullName clinicName specialization clinicAddress phone' })
      .populate({ path: 'patientId', select: 'fullName phone email userId' });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Authorization check
    const isPatient = bill.patientId &&
      bill.patientId.userId &&
      bill.patientId.userId.toString() === req.user._id.toString();
    const isDoctor = bill.doctorId &&
      bill.doctorId.userId &&
      bill.doctorId.userId.toString() === req.user._id.toString();

    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this bill'
      });
    }

    // Return bill data as downloadable JSON (in production, generate PDF)
    const billData = {
      invoiceNumber: bill.invoiceNumber,
      date: bill.createdAt,
      dueDate: bill.dueDate,
      status: bill.status,
      paidAt: bill.paidAt,
      doctor: {
        name: bill.doctorId.fullName,
        clinic: bill.doctorId.clinicName,
        specialization: bill.doctorId.specialization,
        address: bill.doctorId.clinicAddress,
        phone: bill.doctorId.phone
      },
      patient: {
        name: bill.patientId.fullName,
        phone: bill.patientId.phone,
        email: bill.patientId.email
      },
      treatment: bill.treatmentName,
      appointment: bill.appointmentId
        ? {
            type: bill.appointmentId.treatmentType,
            date: bill.appointmentId.date,
            time: bill.appointmentId.time
          }
        : null,
      amount: bill.amount,
      discountFromRewards: bill.discountFromRewards,
      finalAmount: bill.finalAmount
    };

    res.status(200).json({
      success: true,
      message: 'Bill data retrieved for download',
      data: billData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to download bill',
      error: error.message
    });
  }
};

// @desc    Update a bill
// @route   PUT /api/bills/:id
// @access  Private (Doctor only)
const updateBill = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id);

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: 'Bill not found'
      });
    }

    // Verify doctor profile
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });
    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    // Verify ownership
    if (bill.doctorId.toString() !== doctorProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this bill'
      });
    }

    // Cannot update a paid bill
    if (bill.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update a paid bill'
      });
    }

    // Allowed update fields
    const allowedFields = ['treatmentName', 'amount', 'discountFromRewards', 'paidAmount', 'dueDate', 'status'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.dueDate) {
      updates.dueDate = new Date(updates.dueDate);
    }

    // Recalculate finalAmount if amount or discount changes
    let currentFinalAmount = bill.finalAmount;
    if (updates.amount !== undefined || updates.discountFromRewards !== undefined) {
      const amt = updates.amount !== undefined ? updates.amount : bill.amount;
      const disc = updates.discountFromRewards !== undefined ? updates.discountFromRewards : bill.discountFromRewards;
      updates.finalAmount = Math.max(amt - disc, 0);
      currentFinalAmount = updates.finalAmount;
    }

    // Check paid status if paidAmount is provided or finalAmount changes
    if (updates.paidAmount !== undefined || updates.finalAmount !== undefined) {
      const paidAmt = updates.paidAmount !== undefined ? updates.paidAmount : bill.paidAmount;
      if (paidAmt >= currentFinalAmount) {
        updates.status = 'paid';
        updates.paidAt = new Date();
      } else {
        updates.status = 'unpaid';
        updates.paidAt = null;
      }
    } else if (updates.status === 'paid') {
      updates.paidAt = new Date();
    } else if (updates.status === 'unpaid') {
      updates.paidAt = null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedBill = await Bill.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate({ path: 'doctorId', select: 'fullName clinicName specialization' })
      .populate({ path: 'patientId', select: 'fullName' })
      .populate({ path: 'appointmentId', select: 'treatmentType date time' });

    res.status(200).json({
      success: true,
      message: 'Bill updated successfully',
      data: updatedBill
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update bill',
      error: error.message
    });
  }
};

// @desc    Get bills for a patient
// @route   GET /api/bills/patient/:patientId
// @access  Private
const getPatientBills = async (req, res) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Verify patient exists
    const patientProfile = await PatientProfile.findById(patientId);
    if (!patientProfile) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const filter = { patientId };

    const [bills, total] = await Promise.all([
      Bill.find(filter)
        .populate({ path: 'doctorId', select: 'fullName clinicName specialization' })
        .populate({ path: 'patientId', select: 'fullName' })
        .populate({ path: 'appointmentId', select: 'treatmentType date time' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Bill.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      count: bills.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: bills
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch patient bills',
      error: error.message
    });
  }
};

module.exports = {
  getMyBills,
  getBillingSummary,
  getBill,
  createBill,
  updateBill,
  payBill,
  downloadBill,
  getPatientBills
};
