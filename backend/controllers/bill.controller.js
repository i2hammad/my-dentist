const prisma = require('../config/prisma');
const { serialize, remapRefs, remapMany } = require('../utils/serialize');
const { generateInvoiceNumber } = require('../utils/invoiceGenerator');
const { reconcileBillCommission } = require('../utils/commission');

const BILL_INCLUDE = {
  doctor: { select: { fullName: true, clinicName: true, specialization: true, userId: true } },
  patient: { select: { fullName: true, userId: true } },
  appointment: { select: { treatmentType: true, date: true, time: true } },
};
const REFMAP = { doctor: 'doctorId', patient: 'patientId', appointment: 'appointmentId' };

async function notify(data) {
  try { await prisma.notification.create({ data }); } catch (e) { console.error('Notification failed:', e.message); }
}
const num = (v, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v));

// @desc    Get current user's bills (paginated)
// @route   GET /api/bills/my
const getMyBills = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const where = {};

    if (req.user.role === 'patient') {
      const p = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
      if (!p) return res.status(404).json({ success: false, message: 'Patient profile not found' });
      where.patientId = p.id;
    } else if (req.user.role === 'doctor') {
      const d = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
      if (!d) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
      where.doctorId = d.id;
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({ where, include: BILL_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.bill.count({ where }),
    ]);

    res.status(200).json({ success: true, count: bills.length, total, page, pages: Math.ceil(total / limit), data: serialize(remapMany(bills, REFMAP)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bills', error: error.message });
  }
};

// @desc    Get billing summary for patient
// @route   GET /api/bills/summary
const getBillingSummary = async (req, res) => {
  try {
    const patientProfile = await prisma.patientProfile.findUnique({ where: { userId: req.user._id } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient profile not found' });

    const bills = await prisma.bill.findMany({ where: { patientId: patientProfile.id }, select: { amount: true, status: true, discountFromRewards: true } });
    const data = bills.reduce((a, b) => {
      a.totalBills += 1;
      if (b.status === 'paid') a.totalPaid += b.amount; else a.outstanding += b.amount;
      a.totalDiscount += b.discountFromRewards || 0;
      return a;
    }, { totalBills: 0, totalPaid: 0, totalDiscount: 0, outstanding: 0 });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch billing summary', error: error.message });
  }
};

// @desc    Get single bill detail
// @route   GET /api/bills/:id
const getBill = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: {
        appointment: { select: { treatmentType: true, date: true, time: true, status: true, description: true } },
        doctor: { select: { fullName: true, clinicName: true, specialization: true, userId: true } },
        patient: { select: { fullName: true, userId: true } },
      },
    });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const isPatient = bill.patient?.userId === req.user._id;
    const isDoctor = bill.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this bill' });
    }

    res.status(200).json({ success: true, data: serialize(remapRefs(bill, REFMAP)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bill', error: error.message });
  }
};

// @desc    Create a new bill
// @route   POST /api/bills
const createBill = async (req, res) => {
  try {
    const { appointmentId, patientId, treatmentName, treatments, amount, dueDate, discountFromRewards, paidAmount, status: reqStatus } = req.body;

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const patientProfile = await prisma.patientProfile.findUnique({ where: { id: patientId } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient not found' });

    if (appointmentId) {
      const existingBill = await prisma.bill.findFirst({ where: { appointmentId } });
      if (existingBill) return res.status(409).json({ success: false, message: 'A bill already exists for this appointment' });
    }

    const amt = num(amount);
    const discount = num(discountFromRewards);
    const finalAmount = Math.max(amt - discount, 0);
    const paid = num(paidAmount);
    const status = reqStatus === 'draft' ? 'draft' : (paid >= finalAmount && finalAmount > 0 ? 'paid' : 'unpaid');

    const bill = await prisma.bill.create({
      data: {
        invoiceNumber: generateInvoiceNumber(),
        appointmentId: appointmentId || null,
        doctorId: doctorProfile.id,
        patientId,
        treatmentName,
        treatments: Array.isArray(treatments) ? treatments.map((t) => ({ name: t.name || '', price: Number(t.price) || 0 })) : [],
        amount: amt,
        finalAmount,
        discountFromRewards: discount,
        paidAmount: paid,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
        paidAt: status === 'paid' ? new Date() : null,
      },
    });

    if (status !== 'draft') {
      await prisma.doctorProfile.update({ where: { id: doctorProfile.id }, data: { rewardPoints: { increment: 50 } } });
    }

    if (status === 'paid') {
      const pts = Math.floor(finalAmount * 0.02);
      if (pts > 0) {
        const existing = await prisma.reward.findFirst({ where: { billId: bill.id } });
        if (!existing) {
          await prisma.reward.create({ data: { patientId, type: 'visit', points: pts, description: 'Points earned from treatment payment (2%)', billId: bill.id } });
        }
      }
      await reconcileBillCommission(bill.id);
    }

    if (status !== 'draft') {
      await notify({
        userId: patientProfile.userId,
        type: 'bill',
        title: 'New Bill Generated',
        message: `A new bill of $${finalAmount.toFixed(2)} for ${treatmentName} has been generated. Invoice: ${bill.invoiceNumber}.`,
        relatedId: bill.id,
        data: { doctorId: String(doctorProfile.id) },
      });
    }

    res.status(201).json({ success: true, message: 'Bill created successfully', data: serialize(bill) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create bill', error: error.message });
  }
};

// @desc    Pay a bill
// @route   PUT /api/bills/:id/pay
const payBill = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { patient: { select: { userId: true, fullName: true } }, doctor: { select: { userId: true, fullName: true } } },
    });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    if (bill.patient?.userId !== req.user._id) return res.status(403).json({ success: false, message: 'Not authorized to pay this bill' });
    if (bill.status === 'paid' || bill.status === 'payment_pending') {
      return res.status(400).json({ success: false, message: bill.status === 'paid' ? 'Bill is already paid' : 'Payment already submitted, awaiting confirmation' });
    }

    const { paymentMethodId } = req.body;
    let paymentType = req.body.paymentType || 'cash';
    let paymentMethodLabel = req.body.paymentMethodLabel || '';

    if (paymentMethodId) {
      const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (!method || method.userId !== req.user._id) return res.status(400).json({ success: false, message: 'Invalid payment method' });
      const isCard = method.type === 'visa' || method.type === 'mastercard';
      paymentType = isCard ? 'card' : 'wallet';
      paymentMethodLabel = `${String(method.type).toUpperCase()}${method.lastFourDigits ? ` ••••${method.lastFourDigits}` : ''}`;
    } else if (paymentType === 'cash') {
      paymentMethodLabel = paymentMethodLabel || 'Cash';
    }

    if (paymentType === 'cash') {
      const updated = await prisma.bill.update({
        where: { id: bill.id },
        data: { paymentMethodId: paymentMethodId || null, paymentType, paymentMethodLabel, status: 'payment_pending' },
      });
      await notify({
        userId: bill.doctor.userId,
        type: 'bill',
        title: 'Cash Payment to Confirm',
        message: `${bill.patient.fullName} marked bill ${bill.invoiceNumber} as paid by cash — confirm receipt.`,
        relatedId: bill.id,
        data: { billId: String(bill.id), action: 'confirm-payment' },
      });
      return res.status(200).json({ success: true, message: 'Marked as cash payment — awaiting doctor confirmation', data: { bill: serialize(updated), rewardPointsEarned: 0, pending: true } });
    }

    // Card / wallet — settle now.
    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { paymentMethodId: paymentMethodId || null, paymentType, paymentMethodLabel, status: 'paid', paidAt: new Date(), paidAmount: bill.finalAmount || bill.amount },
    });
    await reconcileBillCommission(bill.id);

    const rewardPoints = Math.floor(bill.amount * 0.02);
    if (rewardPoints > 0) {
      const existing = await prisma.reward.findFirst({ where: { billId: bill.id } });
      if (!existing) await prisma.reward.create({ data: { patientId: bill.patientId, type: 'visit', points: rewardPoints, description: 'Points earned from treatment payment (2%)', billId: bill.id } });
    }

    await notify({
      userId: bill.doctor.userId,
      type: 'bill',
      title: 'Bill Payment Received',
      message: `${bill.patient.fullName} paid bill ${bill.invoiceNumber} (PKR ${(bill.finalAmount || bill.amount).toLocaleString()}) via ${paymentMethodLabel}.`,
      relatedId: bill.id,
      data: { billId: String(bill.id) },
    });

    res.status(200).json({ success: true, message: 'Bill paid successfully', data: { bill: serialize(updated), rewardPointsEarned: rewardPoints } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process payment', error: error.message });
  }
};

// @desc    Doctor confirms a pending (cash) payment
// @route   PUT /api/bills/:id/confirm-payment
const confirmPayment = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: { patient: { select: { userId: true, fullName: true } }, doctor: { select: { userId: true, fullName: true } } },
    });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
    if (bill.doctor?.userId !== req.user._id) return res.status(403).json({ success: false, message: 'Not authorized to confirm this payment' });
    if (bill.status !== 'payment_pending') return res.status(400).json({ success: false, message: 'This bill is not awaiting payment confirmation' });

    const updated = await prisma.bill.update({
      where: { id: bill.id },
      data: { status: 'paid', paidAt: new Date(), paidAmount: bill.finalAmount || bill.amount },
    });
    await reconcileBillCommission(bill.id);

    const rewardPoints = Math.floor(bill.amount * 0.02);
    if (rewardPoints > 0) {
      const existing = await prisma.reward.findFirst({ where: { billId: bill.id } });
      if (!existing) await prisma.reward.create({ data: { patientId: bill.patientId, type: 'visit', points: rewardPoints, description: 'Points earned from treatment payment (2%)', billId: bill.id } });
    }

    await notify({
      userId: bill.patient.userId,
      type: 'bill',
      title: 'Payment Confirmed',
      message: `${bill.doctor.fullName || 'Your doctor'} confirmed your payment for bill ${bill.invoiceNumber}.`,
      relatedId: bill.id,
      data: { billId: String(bill.id) },
    });

    res.status(200).json({ success: true, message: 'Payment confirmed', data: { bill: serialize(updated), rewardPointsEarned: rewardPoints } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to confirm payment', error: error.message });
  }
};

// @desc    Download bill data
// @route   GET /api/bills/:id/download
const downloadBill = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.id },
      include: {
        appointment: { select: { treatmentType: true, date: true, time: true } },
        doctor: { select: { fullName: true, clinicName: true, specialization: true, address: true, phone: true, userId: true } },
        patient: { select: { fullName: true, mobileNumber: true, userId: true } },
      },
    });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const isPatient = bill.patient?.userId === req.user._id;
    const isDoctor = bill.doctor?.userId === req.user._id;
    if (!isPatient && !isDoctor && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to download this bill' });
    }

    const billData = {
      invoiceNumber: bill.invoiceNumber,
      date: bill.createdAt,
      dueDate: bill.dueDate,
      status: bill.status,
      paidAt: bill.paidAt,
      doctor: { name: bill.doctor.fullName, clinic: bill.doctor.clinicName, specialization: bill.doctor.specialization, address: bill.doctor.address, phone: bill.doctor.phone },
      patient: { name: bill.patient.fullName, phone: bill.patient.mobileNumber },
      treatment: bill.treatmentName,
      appointment: bill.appointment ? { type: bill.appointment.treatmentType, date: bill.appointment.date, time: bill.appointment.time } : null,
      amount: bill.amount,
      discountFromRewards: bill.discountFromRewards,
      finalAmount: bill.finalAmount,
    };

    res.status(200).json({ success: true, message: 'Bill data retrieved for download', data: serialize(billData) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to download bill', error: error.message });
  }
};

// @desc    Update a bill
// @route   PUT /api/bills/:id
const updateBill = async (req, res) => {
  try {
    const bill = await prisma.bill.findUnique({ where: { id: req.params.id } });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });

    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });
    if (bill.doctorId !== doctorProfile.id) return res.status(403).json({ success: false, message: 'Not authorized to update this bill' });
    if (bill.status === 'paid') return res.status(400).json({ success: false, message: 'Cannot update a paid bill' });

    const updates = {};
    if (req.body.treatmentName !== undefined) updates.treatmentName = req.body.treatmentName;
    if (req.body.treatments !== undefined) updates.treatments = Array.isArray(req.body.treatments) ? req.body.treatments.map((t) => ({ name: t.name || '', price: Number(t.price) || 0 })) : [];
    if (req.body.amount !== undefined) updates.amount = num(req.body.amount);
    if (req.body.discountFromRewards !== undefined) updates.discountFromRewards = num(req.body.discountFromRewards);
    if (req.body.paidAmount !== undefined) updates.paidAmount = num(req.body.paidAmount);
    if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    if (req.body.status !== undefined) updates.status = req.body.status;

    let currentFinalAmount = bill.finalAmount;
    if (updates.amount !== undefined || updates.discountFromRewards !== undefined) {
      const amt = updates.amount !== undefined ? updates.amount : bill.amount;
      const disc = updates.discountFromRewards !== undefined ? updates.discountFromRewards : bill.discountFromRewards;
      updates.finalAmount = Math.max(amt - disc, 0);
      currentFinalAmount = updates.finalAmount;
    }

    if (updates.status === 'draft') {
      updates.paidAt = null;
    } else if (updates.paidAmount !== undefined || updates.finalAmount !== undefined) {
      const paidAmt = updates.paidAmount !== undefined ? updates.paidAmount : bill.paidAmount;
      if (paidAmt >= currentFinalAmount && currentFinalAmount > 0) {
        updates.status = 'paid';
        updates.paidAt = new Date();
      } else if (bill.status !== 'draft') {
        updates.status = 'unpaid';
        updates.paidAt = null;
      }
    } else if (updates.status === 'paid') {
      updates.paidAt = new Date();
    } else if (updates.status === 'unpaid') {
      updates.paidAt = null;
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: 'No valid fields to update' });

    const updatedBill = await prisma.bill.update({ where: { id: req.params.id }, data: updates, include: BILL_INCLUDE });

    if (updates.status === 'paid' && bill.status !== 'paid') {
      await prisma.doctorProfile.update({ where: { id: doctorProfile.id }, data: { rewardPoints: { increment: 50 } } });
      const paidFinal = updates.finalAmount !== undefined ? updates.finalAmount : (bill.finalAmount || bill.amount);
      const pts = Math.floor(paidFinal * 0.02);
      if (pts > 0) {
        const existing = await prisma.reward.findFirst({ where: { billId: bill.id } });
        if (!existing) await prisma.reward.create({ data: { patientId: bill.patientId, type: 'visit', points: pts, description: 'Points earned from treatment payment (2%)', billId: bill.id } });
      }
    }

    await reconcileBillCommission(updatedBill.id);

    res.status(200).json({ success: true, message: 'Bill updated successfully', data: serialize(remapRefs(updatedBill, REFMAP)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bill', error: error.message });
  }
};

// @desc    Get bills for a patient
// @route   GET /api/bills/patient/:patientId
const getPatientBills = async (req, res) => {
  try {
    const { patientId } = req.params;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    const patientProfile = await prisma.patientProfile.findUnique({ where: { id: patientId } });
    if (!patientProfile) return res.status(404).json({ success: false, message: 'Patient not found' });

    const where = { patientId };
    const [bills, total] = await Promise.all([
      prisma.bill.findMany({ where, include: BILL_INCLUDE, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.bill.count({ where }),
    ]);

    res.status(200).json({ success: true, count: bills.length, total, page, pages: Math.ceil(total / limit), data: serialize(remapMany(bills, REFMAP)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch patient bills', error: error.message });
  }
};

module.exports = { getMyBills, getBillingSummary, getBill, createBill, updateBill, payBill, confirmPayment, downloadBill, getPatientBills };
