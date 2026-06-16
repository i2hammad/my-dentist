const mongoose = require('mongoose');
const Treatment = require('../models/Treatment');
const DoctorProfile = require('../models/DoctorProfile');

// @desc    Get logged-in doctor's treatments
// @route   GET /api/treatments/my
// @access  Protected (doctor)
const getMyTreatments = async (req, res) => {
  try {
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found. Please create a doctor profile first.'
      });
    }

    const filter = { doctorId: doctorProfile._id };

    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    const treatments = await Treatment.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: treatments.length,
      data: treatments
    });
  } catch (error) {
    console.error('Get my treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatments'
    });
  }
};

// @desc    Get all treatments for a doctor
// @route   GET /api/treatments/doctor/:doctorId
// @access  Public
const getDoctorTreatments = async (req, res) => {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }

    // Verify doctor exists
    const doctor = await DoctorProfile.findById(doctorId).select('_id fullName').lean();
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found'
      });
    }

    // Build filter
    const filter = { doctorId };

    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Treatment.countDocuments(filter);

    const treatments = await Treatment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count: treatments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: treatments
    });
  } catch (error) {
    console.error('Get doctor treatments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching treatments'
    });
  }
};

// @desc    Create a treatment
// @route   POST /api/treatments
// @access  Protected (doctor)
const createTreatment = async (req, res) => {
  try {
    // Find the doctor profile for the current user
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found. Please create a doctor profile first.'
      });
    }

    const { name, priceMin, priceMax } = req.body;

    // Validate price range
    if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
      return res.status(400).json({
        success: false,
        message: 'priceMin cannot be greater than priceMax'
      });
    }

    const treatment = await Treatment.create({
      doctorId: doctorProfile._id,
      name,
      priceMin,
      priceMax
    });

    res.status(201).json({
      success: true,
      message: 'Treatment created successfully',
      data: treatment
    });
  } catch (error) {
    console.error('Create treatment error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A treatment with this name already exists for this doctor'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating treatment'
    });
  }
};

// @desc    Update a treatment
// @route   PUT /api/treatments/:id
// @access  Protected (doctor)
const updateTreatment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid treatment ID format'
      });
    }

    // Find the doctor profile for the current user
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    // Find the treatment
    const treatment = await Treatment.findById(req.params.id);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    // Verify ownership
    if (treatment.doctorId.toString() !== doctorProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this treatment'
      });
    }

    // Allowed update fields
    const allowedFields = ['name', 'priceMin', 'priceMax', 'active'];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Validate price range if both are present
    const newMin = updates.priceMin !== undefined ? updates.priceMin : treatment.priceMin;
    const newMax = updates.priceMax !== undefined ? updates.priceMax : treatment.priceMax;
    if (newMin !== undefined && newMax !== undefined && newMin > newMax) {
      return res.status(400).json({
        success: false,
        message: 'priceMin cannot be greater than priceMax'
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const updatedTreatment = await Treatment.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Treatment updated successfully',
      data: updatedTreatment
    });
  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating treatment'
    });
  }
};

// @desc    Delete a treatment
// @route   DELETE /api/treatments/:id
// @access  Protected (doctor)
const deleteTreatment = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid treatment ID format'
      });
    }

    // Find the doctor profile for the current user
    const doctorProfile = await DoctorProfile.findOne({ userId: req.user._id });

    if (!doctorProfile) {
      return res.status(404).json({
        success: false,
        message: 'Doctor profile not found'
      });
    }

    // Find the treatment
    const treatment = await Treatment.findById(req.params.id);

    if (!treatment) {
      return res.status(404).json({
        success: false,
        message: 'Treatment not found'
      });
    }

    // Verify ownership
    if (treatment.doctorId.toString() !== doctorProfile._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this treatment'
      });
    }

    await Treatment.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Treatment deleted successfully',
      data: { _id: req.params.id }
    });
  } catch (error) {
    console.error('Delete treatment error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting treatment'
    });
  }
};

module.exports = {
  getMyTreatments,
  getDoctorTreatments,
  createTreatment,
  updateTreatment,
  deleteTreatment
};
