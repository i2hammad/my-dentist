const prisma = require('../config/prisma');
const { serialize } = require('../utils/serialize');

// @desc    Get logged-in doctor's treatments
// @route   GET /api/treatments/my
// @access  Protected (doctor)
const getMyTreatments = async (req, res) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found. Please create a doctor profile first.' });
    }

    const where = { doctorId: doctorProfile.id };
    if (req.query.active !== undefined) where.isActive = req.query.active === 'true';

    const treatments = await prisma.treatment.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.status(200).json({ success: true, count: treatments.length, data: serialize(treatments) });
  } catch (error) {
    console.error('Get my treatments error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching treatments' });
  }
};

// @desc    Get all treatments for a doctor
// @route   GET /api/treatments/doctor/:doctorId
// @access  Public
const getDoctorTreatments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { id: true, fullName: true } });
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const where = { doctorId };
    if (req.query.active !== undefined) where.isActive = req.query.active === 'true';

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const [total, treatments] = await Promise.all([
      prisma.treatment.count({ where }),
      prisma.treatment.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);

    res.status(200).json({
      success: true,
      count: treatments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: serialize(treatments),
    });
  } catch (error) {
    console.error('Get doctor treatments error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching treatments' });
  }
};

// @desc    Create a treatment
// @route   POST /api/treatments
// @access  Protected (doctor)
const createTreatment = async (req, res) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) {
      return res.status(404).json({ success: false, message: 'Doctor profile not found. Please create a doctor profile first.' });
    }

    const { name, priceMin, priceMax } = req.body;
    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      return res.status(400).json({ success: false, message: 'priceMin cannot be greater than priceMax' });
    }

    // Reject a duplicate name for this doctor (case-insensitive). The DB partial
    // unique index on (doctorId, lower(name)) is the hard backstop for races.
    const existing = await prisma.treatment.findFirst({
      where: { doctorId: doctorProfile.id, name: { equals: (name || '').trim(), mode: 'insensitive' } },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a treatment with this name.' });
    }

    let treatment;
    try {
      treatment = await prisma.treatment.create({
        data: {
          doctorId: doctorProfile.id,
          name: (name || '').trim(),
          priceMin: priceMin ?? 0,
          priceMax: priceMax ?? 0,
        },
      });
    } catch (err) {
      // P2002 = unique constraint hit (a concurrent double-submit slipped past the check).
      if (err?.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'You already have a treatment with this name.' });
      }
      throw err;
    }

    res.status(201).json({ success: true, message: 'Treatment created successfully', data: serialize(treatment) });
  } catch (error) {
    console.error('Create treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating treatment' });
  }
};

// @desc    Update a treatment
// @route   PUT /api/treatments/:id
// @access  Protected (doctor)
const updateTreatment = async (req, res) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const treatment = await prisma.treatment.findUnique({ where: { id: req.params.id } });
    if (!treatment) return res.status(404).json({ success: false, message: 'Treatment not found' });
    if (treatment.doctorId !== doctorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this treatment' });
    }

    const updates = {};
    if (req.body.name !== undefined) updates.name = req.body.name;
    if (req.body.priceMin !== undefined) updates.priceMin = req.body.priceMin;
    if (req.body.priceMax !== undefined) updates.priceMax = req.body.priceMax;
    if (req.body.active !== undefined) updates.isActive = req.body.active; // schema field is isActive
    if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;

    const newMin = updates.priceMin !== undefined ? updates.priceMin : treatment.priceMin;
    const newMax = updates.priceMax !== undefined ? updates.priceMax : treatment.priceMax;
    if (newMin > newMax) {
      return res.status(400).json({ success: false, message: 'priceMin cannot be greater than priceMax' });
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const updated = await prisma.treatment.update({ where: { id: req.params.id }, data: updates });
    res.status(200).json({ success: true, message: 'Treatment updated successfully', data: serialize(updated) });
  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating treatment' });
  }
};

// @desc    Delete a treatment
// @route   DELETE /api/treatments/:id
// @access  Protected (doctor)
const deleteTreatment = async (req, res) => {
  try {
    const doctorProfile = await prisma.doctorProfile.findUnique({ where: { userId: req.user._id } });
    if (!doctorProfile) return res.status(404).json({ success: false, message: 'Doctor profile not found' });

    const treatment = await prisma.treatment.findUnique({ where: { id: req.params.id } });
    if (!treatment) return res.status(404).json({ success: false, message: 'Treatment not found' });
    if (treatment.doctorId !== doctorProfile.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this treatment' });
    }

    await prisma.treatment.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Treatment deleted successfully', data: { _id: req.params.id } });
  } catch (error) {
    console.error('Delete treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting treatment' });
  }
};

module.exports = { getMyTreatments, getDoctorTreatments, createTreatment, updateTreatment, deleteTreatment };
