const Favorite = require('../models/Favorite');
const DoctorProfile = require('../models/DoctorProfile');

// @desc    Get user's favorited doctors
// @route   GET /api/favorites
// @access  Private
const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ patientId: req.user._id })
      .populate({
        path: 'doctorId',
        model: 'DoctorProfile',
        match: { isBlocked: { $ne: true } }, // blocked doctors drop out of favorites
        select: 'fullName photo specialization clinicName clinicTier onlineStatus coordinates address city pmdcVerified experience avgRating totalReviews facilityScore',
      })
      .sort({ createdAt: -1 })
      .lean();

    // Filter out favorites whose doctor no longer exists OR is now blocked
    // (a non-matching populate leaves doctorId null).
    const validFavorites = favorites.filter((fav) => fav.doctorId !== null);

    res.status(200).json({
      success: true,
      count: validFavorites.length,
      data: validFavorites,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorites',
      error: error.message,
    });
  }
};

// @desc    Add doctor to favorites
// @route   POST /api/favorites/:doctorId
// @access  Private
const addFavorite = async (req, res) => {
  try {
    const { doctorId } = req.params;

    // Verify doctor exists and isn't blocked (doctorId is DoctorProfile._id)
    const doctor = await DoctorProfile.findById(doctorId);
    if (!doctor || doctor.isBlocked) {
      return res.status(404).json({
        success: false,
        message: 'Doctor not found',
      });
    }

    // Prevent favoriting yourself
    if (doctor.userId && doctor.userId.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself to favorites',
      });
    }

    // Check for existing favorite (prevent duplicates)
    const existingFavorite = await Favorite.findOne({
      patientId: req.user._id,
      doctorId,
    });

    if (existingFavorite) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is already in your favorites',
      });
    }

    const favorite = await Favorite.create({
      patientId: req.user._id,
      doctorId,
    });

    res.status(201).json({
      success: true,
      data: favorite,
      message: 'Doctor added to favorites',
    });
  } catch (error) {
    // Handle duplicate key error from compound index
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Doctor is already in your favorites',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add favorite',
      error: error.message,
    });
  }
};

// @desc    Remove doctor from favorites
// @route   DELETE /api/favorites/:doctorId
// @access  Private
const removeFavorite = async (req, res) => {
  try {
    const { doctorId } = req.params;

    const favorite = await Favorite.findOneAndDelete({
      patientId: req.user._id,
      doctorId,
    });

    if (!favorite) {
      return res.status(404).json({
        success: false,
        message: 'Favorite not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Doctor removed from favorites',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to remove favorite',
      error: error.message,
    });
  }
};

module.exports = {
  getFavorites,
  addFavorite,
  removeFavorite,
};
